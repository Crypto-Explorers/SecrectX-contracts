import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ERC20Mock, IDOFactory } from "@ethers-v6";
import { Reverter } from "@/test/helpers/reverter";
import { DECIMAL } from "@/scripts/utils/constants";

describe("IDOFactory", () => {
  const reverter = new Reverter();

  const IDO_TOKEN_AMOUNT = 1000n * DECIMAL;

  let FIRST: SignerWithAddress;

  let idoToken: ERC20Mock;
  let stakeToken: ERC20Mock;

  let factory: IDOFactory;

  beforeEach(async () => {
    [FIRST] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    idoToken = await ERC20Mock.deploy("IDO TOKEN", "IDOT", 18);
    stakeToken = await ERC20Mock.deploy("Stake TOKEN", "ST", 18);

    const IDOFactory = await ethers.getContractFactory("IDOFactory");
    factory = await IDOFactory.deploy(stakeToken);

    await idoToken.mint(FIRST.address, IDO_TOKEN_AMOUNT);
    await idoToken.approve(factory.getAddress(), IDO_TOKEN_AMOUNT);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("should deploy TimeToHold ido contract", async () => {
    let tx = await factory.deployTimeToHoldIDO(
      idoToken.getAddress(),
      IDO_TOKEN_AMOUNT,
      (await ethers.provider.getBlock("latest")).timestamp + 1000,
      (await ethers.provider.getBlock("latest")).timestamp + 3000,
      (await ethers.provider.getBlock("latest")).timestamp + 5000,
      "https://example.com/project",
    );

    let filter = factory.filters.TimeToHoldDeployed;
    let events = await factory.queryFilter(filter, -1);

    const TimeToHoldIDO = await ethers.getContractFactory("TimeToHoldIDO");
    let idoContract = await TimeToHoldIDO.attach(events[0].args.ido);

    expect(await idoContract.stakeToken()).to.eq(await stakeToken.getAddress());
    expect(await idoContract.idoToken()).to.eq(await idoToken.getAddress());
    expect(await idoContract.totalStaked()).to.eq(0n);
    expect(await idoContract.totalIDOTokens()).to.eq(IDO_TOKEN_AMOUNT);
    expect(await idoContract.startTimestamp()).to.eq((await ethers.provider.getBlock("latest")).timestamp + 1000 - 1);
    expect(await idoContract.endStakeTimestamp()).to.eq(
      (await ethers.provider.getBlock("latest")).timestamp + 3000 - 1,
    );
    expect(await idoContract.endIDOTimestamp()).to.eq((await ethers.provider.getBlock("latest")).timestamp + 5000 - 1);
    expect(await idoContract.projectDescriptionLink()).to.eq("https://example.com/project");
  });
});
