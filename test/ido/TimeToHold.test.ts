import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { TimeToHoldIDO, ERC20Mock } from "@ethers-v6";
import { Reverter } from "@/test/helpers/reverter";
import { DECIMAL } from "@/scripts/utils/constants";

describe("TimeToHoldIDO", () => {
  function calculateReward(userStake: bigint, totalIDOTokens: bigint, totalStaked: bigint): bigint {
    return (userStake * totalIDOTokens) / totalStaked;
  }

  const reverter = new Reverter();

  const IDO_TOKEN_AMOUNT = 1000n * DECIMAL;
  const INITIAL_BALANCE = 10n ** 19n;

  const amountFirst = 5n * DECIMAL;
  const amountSecond = 10n * DECIMAL;

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;

  let idoToken: ERC20Mock;
  let stakeToken: ERC20Mock;
  let idoContract: TimeToHoldIDO;

  beforeEach(async () => {
    [FIRST, SECOND, THIRD] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    idoToken = await ERC20Mock.deploy("IDO TOKEN", "IDOT", 18);
    stakeToken = await ERC20Mock.deploy("Stake TOKEN", "ST", 18);

    const TimeToHoldIDO = await ethers.getContractFactory("TimeToHoldIDO");
    idoContract = await TimeToHoldIDO.deploy();

    await idoToken.mint(idoContract.getAddress(), IDO_TOKEN_AMOUNT);

    await stakeToken.mint(FIRST.address, INITIAL_BALANCE);
    await stakeToken.mint(SECOND.address, INITIAL_BALANCE);
    await stakeToken.mint(THIRD.address, INITIAL_BALANCE);

    await stakeToken.approve(idoContract.getAddress(), INITIAL_BALANCE);
    await stakeToken.connect(SECOND).approve(idoContract.getAddress(), INITIAL_BALANCE);
    await stakeToken.connect(THIRD).approve(idoContract.getAddress(), INITIAL_BALANCE);

    await idoContract.initialize(
      stakeToken.getAddress(),
      idoToken.getAddress(),
      IDO_TOKEN_AMOUNT,
      (await ethers.provider.getBlock("latest")).timestamp + 1000,
      (await ethers.provider.getBlock("latest")).timestamp + 3000,
      (await ethers.provider.getBlock("latest")).timestamp + 5000,
      "https://example.com/project",
    );

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#initialize", () => {
    it("should set parameters correctly", async () => {
      expect(await idoContract.stakeToken()).to.eq(await stakeToken.getAddress());
      expect(await idoContract.idoToken()).to.eq(await idoToken.getAddress());
      expect(await idoContract.totalStaked()).to.eq(0n);
      expect(await idoContract.totalIDOTokens()).to.eq(IDO_TOKEN_AMOUNT);
      expect(await idoContract.startTimestamp()).to.eq((await ethers.provider.getBlock("latest")).timestamp + 1000 - 1);
      expect(await idoContract.endStakeTimestamp()).to.eq(
        (await ethers.provider.getBlock("latest")).timestamp + 3000 - 1,
      );
      expect(await idoContract.endIDOTimestamp()).to.eq(
        (await ethers.provider.getBlock("latest")).timestamp + 5000 - 1,
      );
      expect(await idoContract.projectDescriptionLink()).to.eq("https://example.com/project");
    });

    it("should reverts with `initialized`", async () => {
      await expect(
        idoContract.initialize(
          stakeToken.getAddress(),
          idoToken.getAddress(),
          IDO_TOKEN_AMOUNT,
          (await ethers.provider.getBlock("latest")).timestamp + 1000,
          (await ethers.provider.getBlock("latest")).timestamp + 3000,
          (await ethers.provider.getBlock("latest")).timestamp + 5000,
          "https://example.com/project",
        ),
      ).to.revertedWith("IDO: initialized");
    });
  });

  describe("#stake", () => {
    beforeEach(async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.startTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");
    });
    it("should allow users to stake tokens during the stake period", async () => {
      await idoContract.connect(FIRST).stake(amountFirst);
      await idoContract.connect(SECOND).stake(amountSecond);

      expect(await idoContract.stakedTokens(FIRST.address)).to.eq(amountFirst);
      expect(await idoContract.stakedTokens(SECOND.address)).to.eq(amountSecond);

      expect(await stakeToken.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountFirst);
      expect(await stakeToken.balanceOf(SECOND.address)).to.eq(INITIAL_BALANCE - amountSecond);

      expect(await stakeToken.balanceOf(idoContract.getAddress())).to.eq(amountFirst + amountSecond);
      expect(await idoContract.totalStaked()).to.eq(amountFirst + amountSecond);
    });

    it("should revert if staking amount is zero", async () => {
      await expect(idoContract.stake(0)).to.be.revertedWith("IDO: zero amount");
    });

    it("should revert if staking outside of the stake period", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");
      await expect(idoContract.stake(500)).to.be.revertedWith("IDO: Not in stake period");
    });
  });

  describe("#unstake", () => {
    beforeEach(async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.startTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).stake(amountFirst);
      await idoContract.connect(SECOND).stake(amountSecond);
    });

    it("should allow users to unstake tokens during the stake period", async () => {
      await idoContract.connect(FIRST).unstake();

      expect(await idoContract.stakedTokens(FIRST.address)).to.eq(0);
      expect(await idoContract.stakedTokens(SECOND.address)).to.eq(amountSecond);
      expect(await idoContract.totalStaked()).to.eq(amountSecond);
      expect(await stakeToken.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE);
      expect(await idoToken.balanceOf(FIRST.address)).to.eq(0n);
    });

    it("should revert if unstaking zero tokens", async () => {
      await idoContract.connect(FIRST).unstake();
      await expect(idoContract.connect(FIRST).unstake()).to.be.revertedWith("IDO: No tokens to unstake");
    });

    it("should revert if unstaking outside of the stake period", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endStakeTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");
      await expect(idoContract.connect(FIRST).unstake()).to.be.revertedWith("IDO: Not in stake period");
    });
  });

  describe("#claim", () => {
    beforeEach(async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.startTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).stake(amountFirst);
      await idoContract.connect(SECOND).stake(amountSecond);
    });

    it("should allow users to claim tokens after the IDO period", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).claim();

      expect(await idoContract.stakedTokens(FIRST.address)).to.eq(0);
      expect(await stakeToken.balanceOf(FIRST.address)).to.eql(INITIAL_BALANCE);
      expect(await idoToken.balanceOf(FIRST.address)).to.eq(
        calculateReward(amountFirst, IDO_TOKEN_AMOUNT, amountFirst + amountSecond),
      );

      await idoContract.connect(SECOND).claim();

      expect(await idoContract.stakedTokens(SECOND.address)).to.eq(0);
      expect(await stakeToken.balanceOf(SECOND.address)).to.eql(INITIAL_BALANCE);
      expect(await idoToken.balanceOf(SECOND.address)).to.eq(
        calculateReward(amountSecond, IDO_TOKEN_AMOUNT, amountFirst + amountSecond),
      );
    });

    it("should revert if claiming zero tokens", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).claim();
      await expect(idoContract.connect(FIRST).claim()).to.be.revertedWith("IDO: No tokens to claim");
    });

    it("should revert if claiming during the stake period", async () => {
      await expect(idoContract.connect(FIRST).claim()).to.be.revertedWith("IDO: period not ended");
    });
  });

  describe("#calculations", () => {
    beforeEach(async () => {
      idoContract = await (await ethers.getContractFactory("TimeToHoldIDO")).deploy();

      await idoContract.initialize(
        stakeToken.getAddress(),
        idoToken.getAddress(),
        200,
        (await ethers.provider.getBlock("latest")).timestamp + 1000,
        (await ethers.provider.getBlock("latest")).timestamp + 3000,
        (await ethers.provider.getBlock("latest")).timestamp + 5000,
        "https://example.com/project",
      );

      await stakeToken.approve(idoContract.getAddress(), INITIAL_BALANCE);
      await stakeToken.connect(SECOND).approve(idoContract.getAddress(), INITIAL_BALANCE);
      await stakeToken.connect(THIRD).approve(idoContract.getAddress(), INITIAL_BALANCE);

      await idoToken.mint(idoContract.getAddress(), 200);

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.startTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");
    });

    it("should calculate reward for stakes 33 66 1", async () => {
      await idoContract.connect(FIRST).stake(33);
      await idoContract.connect(SECOND).stake(66);
      await idoContract.connect(THIRD).stake(1);

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).claim();
      await idoContract.connect(SECOND).claim();
      await idoContract.connect(THIRD).claim();

      expect(await idoToken.balanceOf(FIRST.address)).to.eq(66);
      expect(await idoToken.balanceOf(SECOND.address)).to.eq(132);
      expect(await idoToken.balanceOf(THIRD.address)).to.eq(2);
    });

    it("should calculate reward for stakes 49 50 1", async () => {
      await idoContract.connect(FIRST).stake(49);
      await idoContract.connect(SECOND).stake(50);
      await idoContract.connect(THIRD).stake(1);

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(FIRST).claim();
      await idoContract.connect(SECOND).claim();
      await idoContract.connect(THIRD).claim();

      expect(await idoToken.balanceOf(FIRST.address)).to.eq(98);
      expect(await idoToken.balanceOf(SECOND.address)).to.eq(100);
      expect(await idoToken.balanceOf(THIRD.address)).to.eq(2);
    });

    it("should calculate reward for stakes 49 49 2", async () => {
      await idoContract.connect(FIRST).stake(49);
      await idoContract.connect(SECOND).stake(49);
      await idoContract.connect(THIRD).stake(2);

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number((await idoContract.endIDOTimestamp()).toString()),
      ]);
      await ethers.provider.send("evm_mine");

      await idoContract.connect(THIRD).claim();
      await idoContract.connect(SECOND).claim();
      await idoContract.connect(FIRST).claim();

      expect(await idoToken.balanceOf(FIRST.address)).to.eq(98);
      expect(await idoToken.balanceOf(SECOND.address)).to.eq(98);
      expect(await idoToken.balanceOf(THIRD.address)).to.eq(4);
    });
  });
});
