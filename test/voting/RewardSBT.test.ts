import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { RewardSBT } from "@ethers-v6";
import { Reverter } from "@/test/helpers/reverter";

describe("RewardSBT", () => {
  const reverter = new Reverter();

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;

  let rewardSBT: RewardSBT;

  beforeEach(async () => {
    [FIRST, SECOND, THIRD] = await ethers.getSigners();

    const RewardSBT = await ethers.getContractFactory("RewardSBT");
    rewardSBT = await RewardSBT.deploy("NFt", "SBT", FIRST.address);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#deployment", () => {
    it("should check deployment parameters", async () => {
      expect(await rewardSBT.owner()).to.eq(FIRST.address);
      expect(await rewardSBT.name()).to.eq("NFt");
      expect(await rewardSBT.symbol()).to.eq("SBT");
    });
  });

  describe("#mint", () => {
    it("should mint a new token", async () => {
      const nextId = await rewardSBT.nextId();

      await rewardSBT.mint(SECOND.address);

      expect((await rewardSBT.balanceOf(SECOND.address)).toString()).to.eq("1");
      expect(await rewardSBT.ownerOf(nextId)).to.eq(SECOND.address);
    });

    it("should revert if caller isn't owner", async () => {
      await expect(rewardSBT.connect(SECOND).mint(SECOND.address)).revertedWithCustomError(
        rewardSBT,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
