import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { ERC20Mock, OTC, TokenWhitelist } from "@ethers-v6";
import { DECIMAL, PERCENTAGE_100, PRECISION, ZERO_ADDR } from "@/scripts/utils/constants";
import { before, beforeEach } from "mocha";

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
    const TokenWhitelist = await ethers.getContractFactory("TokenWhitelist");

    tokenA = await ERC20Mock.deploy("TokenA", "TA", 18);
    tokenB = await ERC20Mock.deploy("TokenB", "TB", 18);

    wl = await TokenWhitelist.deploy();
    await wl.changeOTCWhitelist(tokenA, true);
    await wl.changeUSDStables(tokenB, true);

    otc = await OTC.deploy(FEE, TREASURY.address, await wl.getAddress());

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

  describe("#createTrade", () => {
    it("should create trade OTC token -> USD", async () => {
      const amountIn = 3n * DECIMAL;
      const amountOut = 4n * DECIMAL;
      const tradeId = await otc.createTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        ZERO_ADDR,
      );
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut, ZERO_ADDR);

      const trade = await otc.trades(tradeId);

      expect(trade.creator).to.eq(FIRST.address);
      expect(trade.buyer).to.eq(ZERO_ADDR);
      expect(trade.tokenIn).to.eq(await tokenA.getAddress());
      expect(trade.tokenOut).to.eq(await tokenB.getAddress());
      expect(trade.amountIn).to.eq(amountIn);
      expect(trade.amountOut).to.eq(amountOut);

      expect(await tokenA.balanceOf(FIRST.address)).to.eq(INITIAL_BALANCE - amountIn);
      expect(await tokenA.balanceOf(await otc.getAddress())).to.eq(amountIn);
    });

    it("should create trade USD -> OTC token", async () => {
      const amountIn = 4n * DECIMAL;
      const amountOut = 3n * DECIMAL;
      const tradeId = await otc.createTrade.staticCall(
        tokenB.getAddress(),
        tokenA.getAddress(),
        amountIn,
        amountOut,
        ZERO_ADDR,
      );
      await otc.createTrade(tokenB.getAddress(), tokenA.getAddress(), amountIn, amountOut, ZERO_ADDR);

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

    it("should create trade with directed buyer", async () => {
      const amountIn = 3n * DECIMAL;
      const amountOut = 4n * DECIMAL;
      const tradeId = await otc.createTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        SECOND.address,
      );
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut, SECOND.address);

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
      await expect(otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 1n, FIRST.address)).to.revertedWith(
        "OTC: creator can't be buyer",
      );
    });

    it("should revert if token not in wl", async () => {
      await wl.changeOTCWhitelist(await tokenA.getAddress(), false);
      await expect(otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 1n, FIRST.address)).to.revertedWith(
        "OTC: tokens must be whitelisted",
      );
    });

    it("should reverts with `token addresses are 0`", async () => {
      await expect(otc.createTrade(ZERO_ADDR, tokenB.getAddress(), 1n, 1n, ZERO_ADDR)).to.revertedWith(
        "OTC: token addresses are 0",
      );

      await expect(otc.createTrade(tokenA.getAddress(), ZERO_ADDR, 1n, 1n, ZERO_ADDR)).to.revertedWith(
        "OTC: token addresses are 0",
      );
    });

    it("should reverts with `same token addresses`", async () => {
      await wl.changeOTCWhitelist(await tokenB.getAddress(), true);
      await expect(otc.createTrade(tokenB.getAddress(), tokenB.getAddress(), 1n, 1n, ZERO_ADDR)).to.revertedWith(
        "OTC: same token addresses",
      );
    });

    it("should reverts with `amounts are 0`", async () => {
      await expect(otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 0n, 1n, ZERO_ADDR)).to.revertedWith(
        "OTC: amounts are 0",
      );

      await expect(otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 0n, ZERO_ADDR)).to.revertedWith(
        "OTC: amounts are 0",
      );
    });
  });

  describe("#buy", async () => {
    const amountIn = 3n * DECIMAL;
    const amountOut = 4n * DECIMAL;
    const fee = (amountOut * FEE) / PERCENTAGE_100;

    let tradeId: bigint;

    beforeEach(async () => {
      tradeId = await otc.createTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        ZERO_ADDR,
      );
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut, ZERO_ADDR);
    });

    it("should buy tokens from trade", async () => {
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
      const beforeBalanceA = await tokenA.balanceOf(await otc.getAddress());
      const beforeBalanceB = await tokenB.balanceOf(await otc.getAddress());

      tradeId = await otc.createTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        SECOND.address,
      );
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut, SECOND.address);

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
      tradeId = await otc.createTrade.staticCall(
        tokenA.getAddress(),
        tokenB.getAddress(),
        amountIn,
        amountOut,
        SECOND.address,
      );
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut, SECOND.address);

      await expect(otc.connect(TREASURY).buy(tradeId)).to.be.revertedWith("OTC: only selected buyer can buy");
    });

    it("should reverts with `trade is already complete`", async () => {
      await otc.connect(SECOND).buy(tradeId);

      await expect(otc.connect(SECOND).buy(tradeId)).to.revertedWith("OTC: trade already completed");
    });
  });
});
