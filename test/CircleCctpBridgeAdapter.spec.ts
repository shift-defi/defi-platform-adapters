import { expect } from "chai";
import { ethers } from "hardhat";
import { reset, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { deal } from "hardhat-deal";

const TOKEN_MESSENGER_ETHEREUM = "0xBd3fa81B58Ba92a82136038B25aDec7066af3155"
const TOKEN_MESSENGER_ARBITRUM = "0x19330d10D9Cc8751218eaf51E8885D058642E08A"
const MESSAGE_TRANSMITTER_ETHEREUM = "0x0a992d191DEeC32aFe36203Ad87D7d289a738F81"

const USDC_ETHEREUM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const USDC_AMOUNT = ethers.parseUnits("100", 6)


describe("CCTP bridge adapter", function () {
    it("Should start birdge process USDC from Ethereum to Arbitrum", async function () {
        await reset(process.env.ETHEREUM_RPC!)

        const [sender] = await ethers.getSigners()
        const usdc = await ethers.getContractAt("IERC20", USDC_ETHEREUM)
        const circleCctpBridgeAdapter = await ethers.deployContract("CircleCctpBridgeAdapter", [
            USDC_ETHEREUM,
            TOKEN_MESSENGER_ETHEREUM,
            MESSAGE_TRANSMITTER_ETHEREUM,
            [{ chainId: 42161, domain: 3 }]
        ])

        await usdc.connect(sender).approve(await circleCctpBridgeAdapter.getAddress(), USDC_AMOUNT)
        await deal(USDC_ETHEREUM, sender, USDC_AMOUNT)

        const token = {
            address_: USDC_ETHEREUM,
            amount: USDC_AMOUNT,
            slippage: 500
        }
        const message = {
            dstChainId: 42161,
            content: "0x",
            bridgeParams: "0x"
        }

        const tx = await circleCctpBridgeAdapter.sendTokenWithMessage(token, message)
        const receipt = await tx.wait();
        expect(receipt?.logs.filter((log) => log.address == MESSAGE_TRANSMITTER_ETHEREUM).length).to.be.gt(0)
    })

    it("Should receive burn and bridge messages", async function () {
        await reset(process.env.ETHEREUM_RPC!)

        const [account] = await ethers.getSigners()
        const circleCctpBridgeAdapter = await ethers.deployContract("CircleCctpBridgeAdapter", [
            USDC_ETHEREUM,
            TOKEN_MESSENGER_ETHEREUM,
            MESSAGE_TRANSMITTER_ETHEREUM,
            []
        ])
        const mockTokenWithMessageReceiver = await ethers.deployContract("MockTokenWithMessageReceiver")

        const burnMessage = ethers.solidityPacked(
            ["uint32", "uint32", "uint32", "uint64", "bytes32", "bytes32", "bytes32", "bytes"],
            [
                0, // version
                3, // source domain
                0, // destination domain
                9999999, // nonce
                ethers.zeroPadValue(TOKEN_MESSENGER_ARBITRUM, 32), // msg sender
                ethers.zeroPadValue(TOKEN_MESSENGER_ETHEREUM, 32), // msg recipient
                ethers.zeroPadValue("0x", 32),
                ethers.solidityPacked(
                    ["uint32", "bytes32", "bytes32", "uint256", "bytes32"],
                    [
                        0,
                        ethers.zeroPadValue(USDC_ARBITRUM, 32),
                        ethers.zeroPadValue(await circleCctpBridgeAdapter.getAddress(), 32),
                        USDC_AMOUNT,
                        ethers.zeroPadValue(ethers.ZeroAddress, 32),
                    ]
                )
            ]
        )

        const payload = new ethers.AbiCoder().encode(
            ["bytes32", "address", "bytes"],
            [
                ethers.keccak256("0x1337"), // traceId
                await mockTokenWithMessageReceiver.getAddress(), // fundsCollector
                "0x1234", // message
            ]
        );
        const message = new ethers.AbiCoder().encode(["uint256", "bytes"], [USDC_AMOUNT, payload]);

        const bridgeMessage = ethers.solidityPacked(
            ["uint32", "uint32", "uint32", "uint64", "bytes32", "bytes32", "bytes32", "bytes"],
            [
                0, // version
                3, // source domain
                0, // destination domain
                9999999 + 1, // nonce
                ethers.zeroPadValue(await circleCctpBridgeAdapter.getAddress(), 32), // msg sender
                ethers.zeroPadValue(await circleCctpBridgeAdapter.getAddress(), 32), // msg recipient
                ethers.zeroPadValue("0x", 32),
                message
            ]
        )

        const messageTransmitter = new ethers.Contract(
            MESSAGE_TRANSMITTER_ETHEREUM,
            [
                "function receiveMessage(bytes, bytes)",
                "function attesterManager() view returns (address)",
                "function setSignatureThreshold(uint256)",
                "function enableAttester(address)"
            ],
            ethers.provider
        )
        const attesterManager = await ethers.getImpersonatedSigner(await messageTransmitter.attesterManager());
        await setBalance(attesterManager.address, ethers.parseEther("10"))
        await messageTransmitter.connect(attesterManager).getFunction("setSignatureThreshold")(1)

        const burnDigest = ethers.keccak256(burnMessage)
        const burnMessageAttestation = await account.provider.send("eth_sign", [account.address, burnDigest])
        await messageTransmitter.connect(attesterManager)
            .enableAttester(ethers.recoverAddress(burnDigest, burnMessageAttestation))

        const bridgeDigest = ethers.keccak256(bridgeMessage)
        const bridgeMessageAttestation = await account.provider.send("eth_sign", [account.address, bridgeDigest])
        await messageTransmitter.connect(attesterManager)
            .enableAttester(ethers.recoverAddress(bridgeDigest, bridgeMessageAttestation))

        const tx = await circleCctpBridgeAdapter.receiveBurnAndBridgeMessages(
            burnMessage,
            bridgeMessage,
            burnMessageAttestation,
            bridgeMessageAttestation
        )
        const receipt = await tx.wait()

        const tokenWithMessageReceivedLogs = receipt?.logs.filter(
            (log) => log.topics[0] === mockTokenWithMessageReceiver.getEvent("TokenWithMessageReceived").fragment.topicHash
        )
        expect(tokenWithMessageReceivedLogs?.length).to.be.gt(0)

        const tokenWithMessageReceivedLog = mockTokenWithMessageReceiver.interface.parseLog((tokenWithMessageReceivedLogs || [])[0] as any)
        expect(tokenWithMessageReceivedLog?.args[0]).to.be.eq(USDC_ETHEREUM)
        expect(tokenWithMessageReceivedLog?.args[1]).to.be.eq(USDC_AMOUNT)
        expect(tokenWithMessageReceivedLog?.args[2]).to.be.eq("0x1234")

    })
});
