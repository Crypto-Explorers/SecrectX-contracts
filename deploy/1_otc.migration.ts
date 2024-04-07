import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { OTC__factory } from "@ethers-v6";

const FEE = 5n * 10n ** 25n; // 5 % (only testnet)
const Treasury = "0xfC47b2cF18E95906386A7235f9EACE8B77A843F5"; // (only testnet)

export = async (deployer: Deployer) => {
  const otc = await deployer.deploy(OTC__factory, [FEE, Treasury]);

  Reporter.reportContracts(["OTC", await otc.getAddress()]);
};
