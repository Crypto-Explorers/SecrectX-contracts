import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { ERC20Mock, OTC } from "@ethers-v6";
import { PERCENTAGE_100, PRECISION, ZERO_ADDR } from "@/scripts/utils/constants";
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

  before(async () => {
    [FIRST, SECOND, TREASURY] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const OTC = await ethers.getContractFactory("OTC");

    tokenA = await ERC20Mock.deploy("TokenA", "TA", 18);
    tokenB = await ERC20Mock.deploy("TokenB", "TB", 18);

    otc = await OTC.deploy(FEE, TREASURY.address);

    await tokenA.mint(FIRST.address, INITIAL_BALANCE);
    await tokenB.mint(SECOND.address, INITIAL_BALANCE);

    await tokenA.approve(await otc.getAddress(), 10n ** 19n);
    await tokenB.connect(SECOND).approve(await otc.getAddress(), 10n ** 19n);

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
    it("should create trade", async () => {
      const amountIn = 3n * 10n ** 18n;
      const amountOut = 4n * 10n ** 18n;
      const tradeId = await otc.createTrade.staticCall(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut);
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut);

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

    it("should reverts with `token addresses are 0`", async () => {
      let tx = otc.createTrade(ZERO_ADDR, tokenB.getAddress(), 1n, 1n);
      expect(tx).to.revertedWith("OTC: token addresses are 0");

      tx = otc.createTrade(tokenA.getAddress(), ZERO_ADDR, 1n, 1n);
      expect(tx).to.revertedWith("OTC: token addresses are 0");
    });

    it("should reverts with `same token addresses`", async () => {
      let tx = otc.createTrade(tokenB.getAddress(), tokenB.getAddress(), 1n, 1n);
      expect(tx).to.revertedWith("OTC: same token addresses");
    });

    it("should reverts with `amounts are 0`", async () => {
      let tx = otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 0n, 1n);
      expect(tx).to.revertedWith("OTC: amounts are 0");

      tx = otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), 1n, 0n);
      expect(tx).to.revertedWith("OTC: amounts are 0");
    });
  });

  describe("#buy", async () => {
    const amountIn = 3n * 10n ** 18n;
    const amountOut = 4n * 10n ** 18n;
    let tradeId: bigint;

    beforeEach(async () => {
      tradeId = await otc.createTrade.staticCall(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut);
      await otc.createTrade(tokenA.getAddress(), tokenB.getAddress(), amountIn, amountOut);
    });

    it("should buy tokens from trade", async () => {
      await otc.connect(SECOND).buy(tradeId);

      const trade = await otc.trades(tradeId);

      const fee = (amountOut * FEE) / PERCENTAGE_100;

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

      expect(await tokenA.balanceOf(SECOND.address)).to.eq(amountIn);
      expect(await tokenB.balanceOf(FIRST.address)).to.eq(amountOut - fee);
      expect(await tokenB.balanceOf(TREASURY.address)).to.eq(fee);
    });

    it("should reverts with `trade is already complete`", async () => {
      await otc.connect(SECOND).buy(tradeId);
      let tx = otc.connect(SECOND).buy(tradeId);

      expect(tx).to.revertedWith("OTC: trade is already complete");
    });

    it("should reverts with `creator can't buy`", async () => {
      let tx = otc.connect(FIRST).buy(tradeId);

      expect(tx).to.revertedWith("OTC: creator can't buy");
    });
  });
});
