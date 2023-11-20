import { task, types } from "hardhat/config";
import { stargateParams } from "./stargate.params";
import { StargateBridgeAdapter } from "../../../typechain-types";
import { renderTaskArgs } from "../../utils"

const CMD = "deploy:stargate"
const findStargateParamsForChain = (chainId: number) => stargateParams.find((p) => p.chainId === chainId);

task(CMD, "Deploy StargateBridgeAdapter to chain")
    .addOptionalParam("nonce", "Deployer nonce", 0, types.int)
    .addFlag("verify", "Verify already deployed contract (nonce used for address calculation")
    .setAction(async (taskArgs, hre) => {
        const lzChains = stargateParams.map(p => ({ chainId: p.chainId, lzChainId: p.lzChainId }))

        if (hre.network.name === "hardhat") {
            Object.entries(hre.config.networks).forEach(([name, config]) => {
                if (config.chainId && findStargateParamsForChain(config.chainId))
                    console.log(`npx hardhat --network ${name} ${CMD} ${renderTaskArgs(taskArgs)}`)
            })
            return;
        }

        const chainId = hre.network.config.chainId;
        if (chainId === undefined) {
            console.log(`Use --network with chainId`)
            return
        }

        const stargateParamsForChain = findStargateParamsForChain(chainId);
        if (stargateParamsForChain === undefined) {
            console.log(`Params for chain ${hre.network.name} not found`)
            return
        }

        const constructorArguments = [
            stargateParamsForChain.stargateRouter,
            lzChains
        ]
        const [deployer] = await hre.ethers.getSigners();

        let contract: StargateBridgeAdapter
        if (!taskArgs.verify) {
            const [deployer] = await hre.ethers.getSigners();
            const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
            if (nonce !== taskArgs.nonce) {
                console.log(`Use deployer with nonce ${taskArgs.nonce}. Current nonce: ${nonce}`)
                return
            }
            contract = await hre.ethers.deployContract("StargateBridgeAdapter", constructorArguments)
            await contract.waitForDeployment()
        } else {
            contract = await hre.ethers.getContractAt(
                "StargateBridgeAdapter",
                hre.ethers.getCreateAddress({ from: deployer.address, nonce: taskArgs.nonce })
            )
        }

        const address = await contract.getAddress()
        console.log(`StargateBridgeAdapter: ${address}`)
        await hre.run("verify:verify", { address, constructorArguments });
    })