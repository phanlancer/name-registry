// These utils will be provider-aware of the hardhat interface
import { ethers } from "hardhat";

import { Blockchain, ProtocolUtils } from "../common";

// Hardhat-Provider Aware Exports
const provider = ethers.provider;
export const getProtocolUtils = () => new ProtocolUtils(provider);
export const getBlockchainUtils = () => new Blockchain(provider);

export {
  getAccounts,
  getEthBalance,
  getRandomAccount,
} from "./accountUtils";
export {
  addSnapshotBeforeRestoreAfterEach,
  getLastBlockTimestamp,
  getProvider,
  getTransactionTimestamp,
  getWaffleExpect,
  increaseTimeAsync,
  mineBlockAsync,
  cacheBeforeEach
} from "./testingUtils";
export {
  getRandomAddress
} from "../common";
