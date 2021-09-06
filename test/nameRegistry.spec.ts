import { utils } from "ethers";
import "module-alias/register";
import { BigNumber } from "@ethersproject/bignumber";

import { Bytes } from "@utils/types";
import { Account } from "@utils/test/types";
import { MAX_UINT_256 } from "@utils/constants";
import { NameRegistry } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {  ether } from "@utils/common";
import {
  getProvider,
  getLastBlockTimestamp,
  addSnapshotBeforeRestoreAfterEach,
  getAccounts,
  getWaffleExpect,
  increaseTimeAsync,
  mineBlockAsync,
} from "@utils/test/index";

const expect = getWaffleExpect();

describe("NameRegistry", () => {
  const lockDuration = 86400; // 1 day
  const lockAmount = ether(0.01); // 0.01 Ether
  const blockFreeze = 5; // 5 blocks
  const feeAmount = ether(0.0005); // 0.0005 Ether

  let nameRegistry: NameRegistry;

  let account1: Account;
  let account2: Account;
  let feeRecipient: Account;

  let deployer: DeployHelper;

  beforeEach(async () => {
    [
      account1,
      account2,
      feeRecipient
    ] = await getAccounts();

    deployer = new DeployHelper(account1.wallet);

    nameRegistry = await deployer.core.deployNameRegistry(
      lockDuration,
      lockAmount,
      blockFreeze,
      feeAmount,
      feeRecipient.address
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  addSnapshotBeforeRestoreAfterEach();

  describe("constructor", async () => {
    beforeEach(async () => {
      nameRegistry = await deployer.core.deployNameRegistry(
        lockDuration,
        lockAmount,
        blockFreeze,
        feeAmount,
        feeRecipient.address
      );
    });

    it("should have the correct feeRecipient address", async () => {
      const actualFeeRecipient = await nameRegistry.feeRecipient();
      expect(actualFeeRecipient).to.eq(feeRecipient.address);
    });

    // TODO: add more test cases for correct inputs
    // TODO: add more test cases for invalid inputs
  });

  describe("commitName", async () => {
    let subjectNameHash: Bytes;

    beforeEach(async () => {
      subjectNameHash = await nameRegistry.getNameHash(account1.address, "hello");
    });

    async function subject(): Promise<any> {
      nameRegistry = nameRegistry.connect(account1.wallet);
      return nameRegistry.commitName(subjectNameHash);
    }

    it("should have increased nameCommits length by 1", async () => {
      const preTotalCommits = await nameRegistry.getTotalNameCommits();
      await subject();
      const postTotalCommits = await nameRegistry.getTotalNameCommits();
      expect(postTotalCommits.sub(preTotalCommits).toNumber()).to.eq(1);
    });

    it("should have correct hash and block number committed", async () => {
      await subject();

      const totalCommits = await nameRegistry.getTotalNameCommits();
      const lastCommit = await nameRegistry.nameCommits(totalCommits.toNumber() - 1);

      const provider = getProvider();
      const currentBlockNumber = await provider.getBlockNumber();
      expect(lastCommit.nameHash).to.eq(subjectNameHash);
      expect(lastCommit.blockNumber).to.eq(currentBlockNumber);
    });

    // TODO: add more test case for invalid inputs
  });

  describe("registerName", async () => {
    let subjectOwner: Account;
    let subjectName: string;
    let subjectSignature: Bytes;
    let subjectAmount: BigNumber;

    beforeEach(async () => {
      subjectName = "hello";
      subjectOwner = account1;
      subjectAmount = lockAmount.add(feeAmount);

      const nameHash = await nameRegistry.getNameHash(subjectOwner.address, subjectName);
      await nameRegistry.commitName(nameHash);

      subjectSignature = await subjectOwner.wallet.signMessage(utils.arrayify(nameHash));
    });

    async function subject(): Promise<any> {
      nameRegistry = nameRegistry.connect(subjectOwner.wallet);
      return nameRegistry.registerName(subjectName, subjectSignature, {value: subjectAmount});
    }

    it("should be registered correctly", async () => {
      // pass 5 blocks
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();

      await subject();

      const totalNames = await nameRegistry.getTotalNames();
      const lastNameRegistered = await nameRegistry.names(totalNames.toNumber() - 1);

      const lastBlockTimeStamp = await getLastBlockTimestamp();
      expect(hex_to_ascii(lastNameRegistered.name)).to.eq(subjectName);
      expect(lastNameRegistered.owner).to.eq(subjectOwner.address);
      expect(lastNameRegistered.registeredTime).to.eq(lastBlockTimeStamp);
    });

    // TODO: add more test cases for invalid inputs, blocks(blockFreeze) and different scenarios
  });

  describe("renewName", async () => {
    let subjectOwner: Account;
    let subjectName: string;
    let subjectAmount: BigNumber;

    beforeEach(async () => {
      subjectName = "hello";
      subjectOwner = account1;
      subjectAmount = feeAmount;

      const nameHash = await nameRegistry.getNameHash(subjectOwner.address, subjectName);
      await nameRegistry.commitName(nameHash);
      // pass 5 blocks
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();

      const signature = await subjectOwner.wallet.signMessage(utils.arrayify(nameHash));
      nameRegistry = nameRegistry.connect(subjectOwner.wallet);
      await nameRegistry.registerName(subjectName, signature, {value: lockAmount.add(feeAmount)});
    });

    async function subject(): Promise<any> {
      return nameRegistry.renewName(subjectName, {value: subjectAmount});
    }

    it("should be renewed correctly", async () => {
      // 10 minutes passed
      await increaseTimeAsync(BigNumber.from(600));

      await subject();

      const index = await nameRegistry.getNameIndex(subjectName);
      const lastNameRegistered = await nameRegistry.names(index.toNumber());

      const lastBlockTimeStamp = await getLastBlockTimestamp()
      expect(hex_to_ascii(lastNameRegistered.name)).to.eq(subjectName);
      expect(lastNameRegistered.owner).to.eq(subjectOwner.address);
      expect(lastNameRegistered.registeredTime).to.eq(lastBlockTimeStamp);
    });

    // TODO: add more test cases for invalid inputs, time async and different scenarios
  });

  describe("unlockNames", async () => {
    let subjectOwner: Account;
    let subjectName: string;

    beforeEach(async () => {
      subjectName = "hello";
      subjectOwner = account1;

      const nameHash = await nameRegistry.getNameHash(subjectOwner.address, subjectName);
      await nameRegistry.commitName(nameHash);
      // pass 5 blocks
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();
      await mineBlockAsync();

      const signature = await subjectOwner.wallet.signMessage(utils.arrayify(nameHash));
      nameRegistry = nameRegistry.connect(subjectOwner.wallet);
      await nameRegistry.registerName(subjectName, signature, {value: lockAmount.add(feeAmount)});
    });

    async function subject(): Promise<any> {
      return nameRegistry.unlockNames();
    }

    it("should unlocked the name", async () => {
      const provider = getProvider();
      // 1 day passed
      await increaseTimeAsync(BigNumber.from(86400));

      const prevBalance = await provider.getBalance(subjectOwner.address);

      const txResponse = await subject();
      const txReceipt = await provider.getTransactionReceipt(txResponse.hash);
      const gasUsed = txReceipt.gasUsed.mul(txResponse.gasPrice);

      const postBalance = await provider.getBalance(subjectOwner.address);
      const index = await nameRegistry.getNameIndex(subjectName);

      expect(index).to.eq(MAX_UINT_256);
      expect(postBalance).to.eq(prevBalance.sub(gasUsed).add(lockAmount));
    });

    // TODO: add more test cases for different scenarios
  });

  // TODO: add more test cases for other ABI functions

  function hex_to_ascii(hex: string)
  {
    var str = "";
    for (var n = 0; n < hex.length; n += 2) {
      const ch = hex.substr(n, 2);
      if (ch != "00" && ch != "0x") {
        str += String.fromCharCode(parseInt(ch, 16));
      }
    }
    return str;
  }
});
