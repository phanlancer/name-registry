# Name Registry

Vanity name registering system resistant against front-running

## Configure

create `.env` file and set the infura key, and deployer wallet private keys(for testing purpose).

```
INFURA_TOKEN=
TEST_DEPLOY_PRIVATE_KEY=
MAINNET_DEPLOY_PRIVATE_KEY=
```

## Commands

### Install project

Install the packages with this command `yarn`.

### Run test

First run local testnet with this command `yarn chain`. Then run `yarn test` on another terminal.

### Deploy contracts

You can deploy the contract on Kovan. By the way, you can also change the network.
`npx hardhat run --network kovan scripts/deploy.ts`
