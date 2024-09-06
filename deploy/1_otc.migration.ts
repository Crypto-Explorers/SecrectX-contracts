import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { ERC20Mock__factory, OTC__factory } from "@ethers-v6";

const FEE = 5n * 10n ** 25n; // 5 % (only testnet)
const Treasury = "0x63Bf3eBD3f190b7d27000b9acb8DC53507bD7A55"; // (only testnet)

export = async (deployer: Deployer) => {
  const otc = await deployer.deploy(OTC__factory, [FEE, Treasury]);

  Reporter.reportContracts(["OTC", await otc.getAddress()]);

  const mock = await deployer.deploy(ERC20Mock__factory, ["USDTOKENX", "USDX", 6]);
  Reporter.reportContracts(["USDX", await mock.getAddress()]);

  const mock2 = await deployer.deploy(ERC20Mock__factory, ["MockX", "MX", 18]);
  Reporter.reportContracts(["MockX", await mock2.getAddress()]);
};
