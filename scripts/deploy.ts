import { ethers } from "hardhat";
import { utils } from "ethers";
import { ether } from "../utils/common";

async function main() {
  const accounts = await ethers.getSigners();

  const lockDuration = 86400; // 1 day
  const lockAmount = ether(0.01); // 0.01 Ether
  const blockFreeze = 5; // 5 blocks
  const feeAmount = ether(0.0005); // 0.0005 Ether
  const feeRecipient = accounts[0].address;

  // deploy Controller
  const NameRegistry = await ethers.getContractFactory('NameRegistry');
  const nameRegistry = await NameRegistry.deploy(lockDuration, lockAmount, blockFreeze, feeAmount, feeRecipient);
  await nameRegistry.deployed();
  console.log("nameRegistry deployed:", nameRegistry.address);

  const nameHash = await nameRegistry.getNameHash(accounts[0].address, 'knight');
  console.log("nameHash: ", nameHash);

  const signature = await accounts[0].signMessage(utils.arrayify(nameHash));
  console.log("signature: ", signature);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
