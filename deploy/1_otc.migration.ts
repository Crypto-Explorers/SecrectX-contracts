import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { OTC__factory } from "@ethers-v6";

const FEE = 5n * 10n ** 25n; // 5 % (only testnet)
const Treasury = "0x63Bf3eBD3f190b7d27000b9acb8DC53507bD7A55"; // (only testnet)

export = async (deployer: Deployer) => {
  const otc = await deployer.deploy(OTC__factory, [FEE, Treasury]);

  Reporter.reportContracts(["OTC", await otc.getAddress()]);
};
