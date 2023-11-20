# **Read-only repo**
# Defi platform adapters

Set of smart contract adapters (for bridge token with message, etc)  

## Developement and deploy
- Project managed via [hardhat](http://hardhat.org)
- Project variables managed via [hardhat configuration variables](https://hardhat.org/hardhat-runner/docs/guides/configuration-variables)
- - Use `npx hardhat vars setup` to check used variables

Use `npx hardhat deploy:XXX` command for deployment. If you run this command with hardhat network (with arg `--network hardhat`) it will prints command for each network.  


For example:
```bash
➜  npx hardhat deploy:stargate --nonce 3
npx hardhat --network optimisticEthereum deploy:stargate  --nonce=3
npx hardhat --network arbitrumOne deploy:stargate  --nonce=3
npx hardhat --network avalanche deploy:stargate  --nonce=3
```
💡 export deployer private key to `DEPLOYER` env variable before run


## Bridge

### Deployments

#### Cicrle CCTP
Details: 
https://www.circle.com/en/cross-chain-transfer-protocol  
Main contract: **contracts/bridge/cctp/CircleCctpBridgeAdapter.sol:CircleCctpBridgeAdapter**

#### Stargate 
Details: https://stargateprotocol.gitbook.io/stargate/  
Main contract: **contracts/bridge/stargate/StargateBridgeAdapter.sol:StargateBridgeAdapter**


### Integration checklist
- [ ] Your contract **MUST** be deployed on source chain and destination chain with same address.
- [ ] Your contract **MUST** implement `ITokenWithMessageReceiver` interface.
- [ ] In `receiveTokenWithMessage` your contract **MUST** transfer tokens from bridge adapter

### How to use:
1. Estimate send fee via `estimateFee`
2. Send token to bridge adapter from your smart contract
3. Call `sendTokenWithMessage` with estimated fees as msg.value


