import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { ERC20Mock, OTC, TokenWhitelist } from "@ethers-v6";
import { DECIMAL, PERCENTAGE_100, PRECISION, ZERO_ADDR } from "@/scripts/utils/constants";
import { before, beforeEach } from "mocha";
import { toBigInt } from "@nomicfoundation/hardhat-network-helpers/dist/src/utils";

describe("OTC", () => {
  const reverter = new Reverter();

  const FEE = 3n * PRECISION;
  const INITIAL_BALANCE = 10n ** 19n;

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let TREASURY: SignerWithAddress;

  let tokenA: ERC20Mock;
  let tokenB: ERC20Mock;
  let otc: OTC;
  let wl: TokenWhitelist;

  before(async () => {
    [FIRST, SECOND, TREASURY] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const OTC = await ethers.getContractFactory("OTC");

    tokenA = await ERC20Mock.deploy("TokenA", "TA", 18);
    tokenB = await ERC20Mock.deploy("TokenB", "TB", 18);

    otc = await OTC.deploy(FEE, TREASURY.address);

    await tokenA.mint(FIRST.address, INITIAL_BALANCE);
    await tokenB.mint(SECOND.address, INITIAL_BALANCE);

    await tokenA.mint(SECOND.address, INITIAL_BALANCE);
    await tokenB.mint(FIRST.address, INITIAL_BALANCE);

    await tokenA.approve(await otc.getAddress(), 10n ** 19n);
    await tokenB.connect(SECOND).approve(await otc.getAddress(), 10n ** 19n);

    await tokenB.approve(await otc.getAddress(), 10n ** 19n);
    await tokenA.connect(SECOND).approve(await otc.getAddress(), 10n ** 19n);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#constructor", () => {
    it("should set parameters correctly", async () => {
      expect(await otc.feeRate()).to.eq(FEE);
      expect(await otc.treasury()).to.eq(TREASURY.address);
    });
  });

  describe("#createSimpleTrade", () => {
    it("should create trade OTC token -> USD", async () => {
      const amountIn = 3n * DECIMAL;
      const amountOut = 4n * DECIMAL;

      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      const tradeId = await otc.createSimpleTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
      );
      await otc.createSimpleTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
      );

      const trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(ZERO_ADDR);
      expect(trade.tokenIn).to.eq(await tokenA.getAddress());
      expect(trade.tokenOut).to.eq(await tokenB.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);
      expect(trade.startTimestamp).to.eq(startTimestamp);
      expect(trade.endTimestamp).to.eq(endTimestamp);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn);
      expect(await tokenA.balanceOf(await otc.getAddress())).to.eq(amountIn);
    });

    it("should create trade USD -> OTC token", async () => {
      const amountIn = 4n * DECIMAL;
      const amountOut = 3n * DECIMAL;
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      const tradeId = await otc.createSimpleTrade.staticCall(
        tokenB.getAddress(),
        tokenA.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
      );
      await otc.createSimpleTrade(
        tokenB.getAddress(),
        tokenA.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
      );

      const trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(ZERO_ADDR);
      expect(trade.tokenIn).to.eq(await tokenB.getAddress());
      expect(trade.tokenOut).to.eq(await tokenA.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);

      expect(await tokenB.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn);
      expect(await tokenB.balanceOf(await otc.getAddress())).to.eq(amountIn);
    });

    it("should reverts with `token addresses are 0`", async () => {
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      await expect(
        otc.createSimpleTrade(ZERO_ADDR, tokenB.getAddress(), 1n, 1n, startTimestamp, endTimestamp),
      ).to.revertedWith("OTC: token addresses are 0");

      await expect(
        otc.createSimpleTrade(tokenA.getAddress(), ZERO_ADDR, 1n, 1n, startTimestamp, endTimestamp),
      ).to.revertedWith("OTC: token addresses are 0");
    });

    it("should reverts with `same token addresses`", async () => {
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      await expect(
        otc.createSimpleTrade(tokenB.getAddress(), tokenB.getAddress(), 1n, 1n, startTimestamp, endTimestamp),
      ).to.revertedWith("OTC: same token addresses");
    });

    it("should reverts with `amounts are 0`", async () => {
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      await expect(
        otc.createSimpleTrade(tokenA.getAddress(), tokenB.getAddress(), 0n, 1n, startTimestamp, endTimestamp),
      ).to.revertedWith("OTC: amounts are 0");

      await expect(
        otc.createSimpleTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 0n, startTimestamp, endTimestamp),
      ).to.revertedWith("OTC: amounts are 0");
    });

    it("should reverts with `timestamps is in past`", async () => {
      await expect(
        otc.createSimpleTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 1n, 0, "10000000000000000"),
      ).to.revertedWith("OTC: timestamps is in past");

      await expect(
        otc.createSimpleTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 1n, "10000000000000000", 0),
      ).to.revertedWith("OTC: timestamps is in past");
    });
  });

  describe("#createTargetTrade", async () => {
    it("should create trade with directed buyer", async () => {
      const amountIn = 3n * DECIMAL;
      const amountOut = 4n * DECIMAL;
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      const tradeId = await otc.createTargetTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );
      await otc.createTargetTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );

      const trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(SECOND.address);
      expect(trade.tokenIn).to.eq(await tokenA.getAddress());
      expect(trade.tokenOut).to.eq(await tokenB.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn);
      expect(await tokenA.balanceOf(await otc.getAddress())).to.eq(amountIn);
    });

    it("should revert if creator is buyer", async () => {
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      await expect(
        otc.createTargetTrade(
          tokenA.getAddress(),
          tokenB.getAddress(),
          1n,
          1n,
          startTimestamp,
          endTimestamp,
          FIRST.address,
        ),
      ).to.revertedWith("OTC: creator can't be buyer");
    });

    it("should revert if paused", async () => {
      await otc.pause();
      // @ts-ignore
      const startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
      const endTimestamp = startTimestamp + 1000;

      await expect(
        otc.createTargetTrade(
          tokenA.getAddress(),
          tokenB.getAddress(),
          1n,
          1n,
          startTimestamp,
          endTimestamp,
          SECOND.address,
        ),
      ).to.revertedWithCustomError(otc, "EnforcedPause");
    });
  });

  describe("#buy", async () => {
    const amountIn = 3n * DECIMAL;
    const amountOut = 4n * DECIMAL;
    const fee = (amountOut * FEE) / PERCENTAGE_100;
    let startTimestamp: number;
    let endTimestamp: number;

    let tradeId: bigint;

    beforeEach(async () => {
      // @ts-ignore
      startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 50;
      endTimestamp = startTimestamp + 1000;

      tradeId = await otc.createTargetTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        ZERO_ADDR,
      );
      await otc.createTargetTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        ZERO_ADDR,
      );
    });

    it("should buy tokens from trade", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await otc.connect(SECOND).buy(tradeId);

      const trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(SECOND.address);
      expect(trade.tokenIn).to.eq(await tokenA.getAddress());
      expect(trade.tokenOut).to.eq(await tokenB.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);

      expect(await tokenA.balanceOf(await otc.getAddress())).to.eq(0);
      expect(await tokenB.balanceOf(await otc.getAddress())).to.eq(0);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn);
      expect(await tokenB.balanceOf(SECOND.address)).to.eq(INITIAL_BALANCE - amountOut);

      expect(await tokenA.balanceOf(SECOND.address)).to.eq(amountIn + INITIAL_BALANCE);
      expect(await tokenB.balanceOf(FIRST.address)).to.eq(amountOut - fee + INITIAL_BALANCE);
      expect(await tokenB.balanceOf(TREASURY.address)).to.eq(fee);
    });

    it("should buy from trade with directed buyer", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      const beforeBalanceA = await tokenA.balanceOf(await otc.getAddress());
      const beforeBalanceB = await tokenB.balanceOf(await otc.getAddress());

      tradeId = await otc.createTargetTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );
      await otc.createTargetTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );

      await otc.connect(SECOND).buy(tradeId);

      let trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(SECOND.address);
      expect(trade.tokenIn).to.eq(await tokenA.getAddress());
      expect(trade.tokenOut).to.eq(await tokenB.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);

      expect(await tokenA.balanceOf(await otc.getAddress())).to.eq(beforeBalanceA);
      expect(await tokenB.balanceOf(await otc.getAddress())).to.eq(beforeBalanceB);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn - beforeBalanceA);
      expect(await tokenB.balanceOf(SECOND.address)).to.eq(INITIAL_BALANCE - amountOut);

      expect(await tokenA.balanceOf(SECOND.address)).to.eq(amountIn + INITIAL_BALANCE);
      expect(await tokenB.balanceOf(FIRST.address)).to.eq(amountOut - fee + INITIAL_BALANCE);
      expect(await tokenB.balanceOf(TREASURY.address)).to.eq(fee);
    });

    it("should revert if buyer not directed", async () => {
      tradeId = await otc.createTargetTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );
      await otc.createTargetTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        SECOND.address,
      );

      await expect(otc.connect(TREASURY).buy(tradeId)).to.be.revertedWith("OTC: only selected buyer can buy");
    });

    it("should reverts with `trade is already complete`", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await otc.connect(SECOND).buy(tradeId);

      await expect(otc.connect(SECOND).buy(tradeId)).to.revertedWith("OTC: trade already completed");
    });

    it("should revert with `not started or expired`", async () => {
      await expect(otc.connect(SECOND).buy(tradeId)).to.revertedWith("OTC: not started or expired");
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTimestamp]);
      await expect(otc.connect(SECOND).buy(tradeId)).to.revertedWith("OTC: not started or expired");
    });

    it("should revert with `creator can't buy``", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);

      await expect(otc.buy(tradeId)).to.revertedWith("OTC: creator can't buy");
    });

    it("should revert if paused", async () => {
      await otc.pause();

      await expect(otc.buy(tradeId)).to.revertedWithCustomError(otc, "EnforcedPause");
    });
  });

  describe("#rejectTrade", () => {
    const amountIn = 3n * DECIMAL;
    const amountOut = 4n * DECIMAL;
    const fee = (amountOut * FEE) / PERCENTAGE_100;
    let startTimestamp: number;
    let endTimestamp: number;

    let tradeId: bigint;

    beforeEach(async () => {
      // @ts-ignore
      startTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 50;
      endTimestamp = startTimestamp + 1000;

      tradeId = await otc.createTargetTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        ZERO_ADDR,
      );
      await otc.createTargetTrade(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        startTimestamp,
        endTimestamp,
        ZERO_ADDR,
      );
    });

    it("should reject trade", async () => {
      const beforeBalance = await tokenA.balanceOf(FIRST.address);
      await otc.rejectTrade(tradeId);

      let trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(ZERO_ADDR);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(beforeBalance + trade.amountIn);
    });

    it("should reject trade if paused", async () => {
      await otc.pause();
      await otc.rejectTrade(tradeId);

      let trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(ZERO_ADDR);
    });

    it("should revert if sender is not creator", async () => {
      await expect(otc.connect(SECOND).rejectTrade(tradeId)).to.revertedWith("OTC: only creator can reject");
    });

    it("should revert if trade already closed", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await otc.connect(SECOND).buy(tradeId);

      await expect(otc.rejectTrade(tradeId)).to.revertedWith("OTC: already closed");
    });
  });

  describe("#setFee", () => {
    it("should set new Fee", async () => {
      const newFee = 10n * PRECISION;
      expect(await otc.feeRate()).not.equal(newFee);

      await otc.setFee(newFee);
      expect(await otc.feeRate()).to.equal(newFee);
    });

    it("should revert if caller not owner", async () => {
      await expect(otc.connect(SECOND).setFee(5n * PRECISION)).to.revertedWithCustomError(
        otc,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should revert if new fee is zero", async () => {
      await expect(otc.setFee(0n)).to.revertedWith("OTC: Invalid fee rate");
    });

    it("should revert if new fee is greater than 100%", async () => {
      await expect(otc.setFee(101n * PRECISION)).to.revertedWith("OTC: Invalid fee rate");
    });
  });

  describe("#setTreasury", () => {
    it("should set treasury", async () => {
      const newTreasury = SECOND.address;
      expect(newTreasury).not.equal(await otc.treasury());

      await otc.setTreasury(newTreasury);
      expect(await otc.treasury()).to.eq(newTreasury);
    });

    it("should revert if caller not owner", async () => {
      await expect(otc.connect(SECOND).setTreasury(SECOND.address)).to.revertedWithCustomError(
        otc,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should revert if new treasury is zero address", async () => {
      await expect(otc.setTreasury(ZERO_ADDR)).to.revertedWith("OTC: Zero address");
    });
  });
});
