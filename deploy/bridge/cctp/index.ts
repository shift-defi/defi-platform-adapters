import { task, types, } from "hardhat/config";
import { cctpParams as mainnetParams } from "./cctp.params";
import { cctpParams as testnetParams } from "./cctp-testnet.params";
import { CircleCctpBridgeAdapter } from "../../../typechain-types";
import { renderTaskArgs } from "../../utils"

const CMD = "deploy:cctp"

const cctpParams = (test: boolean) => test ? testnetParams : mainnetParams;
const findCctpParamsForChain = (chainId: number, test: boolean) => cctpParams(test).find((p) => p.chainId === chainId)

task(CMD, "Deploy CircleCctpBridgeAdapter to chain")
    .addFlag("testnet", "Use testnet params")
    .addOptionalParam("nonce", "Deployer nonce", 0, types.int)
    .addFlag("verify", "Verify already deployed contract (nonce used for address calculation")
    .setAction(async (taskArgs, hre) => {
        const circleDomains = cctpParams(taskArgs.testnet).map((chainInfo) => ({
            chainId: chainInfo.chainId,
            domain: chainInfo.domain
        }))

        if (hre.network.name === "hardhat") {
            Object.entries(hre.config.networks).forEach(([name, config]) => {
                if (config.chainId && findCctpParamsForChain(config.chainId, taskArgs.testnet))
                    console.log(`npx hardhat --network ${name} ${CMD} ${renderTaskArgs(taskArgs)}`)
            })
            return;
        }

        const chainId = hre.network.config.chainId;
        if (chainId === undefined) {
            console.log(`Use --network with chainId`)
            return
        }

        const cctpParamsForChain = findCctpParamsForChain(chainId, taskArgs.testnet)
        if (cctpParamsForChain === undefined) {
            console.log(`Params for chain ${hre.network.name} not found`)
            return
        }

        const constructorArguments = [
            cctpParamsForChain.usdc,
            cctpParamsForChain.tokenMessenger,
            cctpParamsForChain.messageTransmitter,
            circleDomains,
        ]
        const [deployer] = await hre.ethers.getSigners();

        let contract: CircleCctpBridgeAdapter
        if (!taskArgs.verify) {
            const [deployer] = await hre.ethers.getSigners();
            const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
            if (nonce !== taskArgs.nonce) {
                console.log(`Use deployer with nonce ${taskArgs.nonce}. Current nonce: ${nonce}`)
                return
            }
            contract = await hre.ethers.deployContract("CircleCctpBridgeAdapter", constructorArguments)
            await contract.waitForDeployment()
        } else {
            contract = await hre.ethers.getContractAt(
                "CircleCctpBridgeAdapter",
                hre.ethers.getCreateAddress({ from: deployer.address, nonce: taskArgs.nonce })
            )
        }

        const address = await contract.getAddress()
        console.log(`CircleCctpBridgeAdapter: ${address}`)
        await hre.run("verify:verify", { address, constructorArguments });
    })