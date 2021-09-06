import { JsonRpcProvider, Web3Provider } from "@ethersproject/providers";

import { ethers } from "ethers";

export class ProtocolUtils {
  public _provider: Web3Provider | JsonRpcProvider;

  constructor(_provider: Web3Provider | JsonRpcProvider) {
    this._provider = _provider;
  }
}
