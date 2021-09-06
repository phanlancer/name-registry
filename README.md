# Name Registry

Vanity name registering system resistant against front-running

## Configure

create `.env` file and set the variables.

```
INFURA_TOKEN=
TEST_DEPLOY_PRIVATE_KEY=
MAINNET_DEPLOY_PRIVATE_KEY=
```

## Commands

### Install project

`yarn`

### Run test

First run local testnet with this command `yarn chain`. Then run `yarn test`.

### Deploy contracts

`npx hardhat run --network kovan scripts/deploy.ts`
