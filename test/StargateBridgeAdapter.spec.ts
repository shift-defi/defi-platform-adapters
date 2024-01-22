import { expect } from "chai";
import { ethers, config } from "hardhat";
import { reset, setBalance, setStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import { deal } from "hardhat-deal";


const USDC_ETHEREUM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const USDC_AMOUNT = ethers.parseUnits("100", 6)
const STARGATE_ETHEREUM = "0xeCc19E177d24551aA7ed6Bc6FE566eCa726CC8a9"
const STARGATE_BRIDGE_ETHEREUM = "0x296F55F8Fb28E498B858d0BcDA06D955B2Cb3f97"

describe("Stargate bridge adapter", function () {
    it("Should start birdge process USDC from Ethereum to Polygon", async function () {
        await reset(process.env.ETHEREUM_RPC!)

        const [sender] = await ethers.getSigners()
        const usdc = await ethers.getContractAt("IERC20", USDC_ETHEREUM)
        const stargateBridgeAdapter = await ethers.deployContract("StargateBridgeAdapter", [
            STARGATE_ETHEREUM,
            [{ chainId: 137, lzChainId: 109 }]
        ]);

        await usdc.connect(sender).approve(await stargateBridgeAdapter.getAddress(), USDC_AMOUNT)
        await deal(USDC_ETHEREUM, sender, USDC_AMOUNT)

        const token = {
            address_: USDC_ETHEREUM,
            amount: USDC_AMOUNT,
            slippage: 500
        }
        const message = {
            dstChainId: 137,
            content: ethers.toUtf8Bytes(""),
            bridgeParams: await stargateBridgeAdapter.generateBridgeParams(1, 500_000)
        }

        const sendFee = await stargateBridgeAdapter.estimateFee(token, message)
        const tx = await stargateBridgeAdapter.sendTokenWithMessage(token, message, { value: sendFee })

        const receipt = await tx.wait();
        expect(receipt?.logs.filter((log) => log.address == STARGATE_BRIDGE_ETHEREUM).length).to.be.gt(0)
    })

    it("Should call TokenWithMessageReceiver in sgReceive", async function () {
        await reset(process.env.ETHEREUM_RPC!)

        const stargateBridgeAdapter = await ethers.deployContract("StargateBridgeAdapter", [STARGATE_BRIDGE_ETHEREUM, []]);
        const mockTokenWithMessageReceiver = await ethers.deployContract("MockTokenWithMessageReceiver")
        await deal(USDC_ETHEREUM, await stargateBridgeAdapter.getAddress(), USDC_AMOUNT)

        const payload = new ethers.AbiCoder().encode(
            ["bytes32", "address", "bytes"],
            [
                ethers.keccak256("0x1337"), // traceId
                await mockTokenWithMessageReceiver.getAddress(), // fundsCollector
                "0x1234", // message
            ]
        );

        const stargate = await ethers.getImpersonatedSigner(STARGATE_BRIDGE_ETHEREUM)
        await setBalance(STARGATE_BRIDGE_ETHEREUM, ethers.parseEther("10"))

        const tx = await stargateBridgeAdapter.connect(stargate).sgReceive(
            109,
            ethers.toUtf8Bytes(await stargateBridgeAdapter.getAddress()),
            0,
            USDC_ETHEREUM,
            USDC_AMOUNT,
            payload
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
