import { Signer } from "ethers";
import { BigNumberish } from "@ethersproject/bignumber";

import { NameRegistry } from "./../contracts";

import { Address, Bytes } from "./../types";

import { NameRegistry__factory } from "../../typechain/factories/NameRegistry__factory";

export default class DeployCoreContracts {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployNameRegistry(
    _lockDuration: BigNumberish,
    _lockAmount: BigNumberish,
    _blockFreeze: BigNumberish,
    _feeAmount: BigNumberish,
    _feeRecipient: Address,
  ): Promise<NameRegistry> {
    return await new NameRegistry__factory(this._deployerSigner).deploy(
      _lockDuration,
      _lockAmount,
      _blockFreeze,
      _feeAmount,
      _feeRecipient
    );
  }

  public async getNameRegistry(registryAddress: Address): Promise<NameRegistry> {
    return await new NameRegistry__factory(this._deployerSigner).attach(registryAddress);
  }
}
