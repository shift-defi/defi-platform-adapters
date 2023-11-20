import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deal";
import 'solidity-docgen';
import "./deploy"

let accounts: string[] = []
if (process.env.DEPLOYER) {
  accounts.push(process.env.DEPLOYER)
}


const config: HardhatUserConfig = {
  solidity: "0.8.21",
  networks: {
    hardhat: {},
    optimisticEthereum: {
      chainId: 10,
      url: vars.get("OP_RPC"),
      accounts
    },
    arbitrumOne: {
      chainId: 42161,
      url: vars.get("ARBITRUM_RPC"),
      accounts
    },
    avalanche: {
      chainId: 43114,
      url: vars.get("AVALANCHE_RPC"),
      accounts
    }
  },
  etherscan: {
    apiKey: {
      optimisticEthereum: vars.get("OPTIMISTIC_ETHERSCAN_API_KEY"),
      avalanche: vars.get("SNOWTRACE_API_KEY"),
      arbitrumOne: vars.get("ARBISCAN_API_KEY"),
    }
  },
  docgen: {
    pages: "files",
  }
};

export default config;
