import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { TokenWhitelist } from "@ethers-v6";
import { before, beforeEach } from "mocha";

describe("TokenWhitelist", () => {
  const reverter = new Reverter();

  const token1 = "0x76e98f7d84603AEb97cd1c89A80A9e914f181679";
  const token2 = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;

  let wl: TokenWhitelist;

  before(async () => {
    [FIRST, SECOND] = await ethers.getSigners();

    const WL = await ethers.getContractFactory("TokenWhitelist");
    wl = await WL.deploy();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#changeOTCWhitelist", () => {
    it("should add token to wl", async () => {
      await wl.changeOTCWhitelist(token1, true);

      expect(await wl.OTCWhitelist(token1)).to.true;
      expect(await wl.OTCWhitelist(token2)).to.false;
    });

    it("should remove token from wl", async () => {
      await wl.changeOTCWhitelist(token1, true);
      await wl.changeOTCWhitelist(token2, true);

      expect(await wl.OTCWhitelist(token1)).to.true;
      expect(await wl.OTCWhitelist(token2)).to.true;

      await wl.changeOTCWhitelist(token1, false);

      expect(await wl.OTCWhitelist(token1)).to.false;
    });

    it("should revert if caller isn't owner", async () => {
      await expect(wl.connect(SECOND).changeOTCWhitelist(token1, true)).revertedWithCustomError(
        wl,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("#changeUSDStables", () => {
    it("should add token to wl", async () => {
      await wl.changeUSDStables(token1, true);

      expect(await wl.USDStables(token1)).to.true;
      expect(await wl.USDStables(token2)).to.false;
    });

    it("should remove token from wl", async () => {
      await wl.changeUSDStables(token1, true);
      await wl.changeUSDStables(token2, true);

      expect(await wl.USDStables(token1)).to.true;
      expect(await wl.USDStables(token2)).to.true;

      await wl.changeUSDStables(token1, false);

      expect(await wl.USDStables(token1)).to.false;
    });

    it("should revert if caller isn't owner", async () => {
      await expect(wl.connect(SECOND).changeUSDStables(token1, true)).revertedWithCustomError(
        wl,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("#bunchChangeOTCWhitelist", () => {
    it("should add token to wl", async () => {
      await wl.bunchChangeOTCWhitelist([token1], [true]);

      expect(await wl.OTCWhitelist(token1)).to.true;
      expect(await wl.OTCWhitelist(token2)).to.false;
    });

    it("should remove token from wl", async () => {
      await wl.bunchChangeOTCWhitelist([token1, token2], [true, true]);

      expect(await wl.OTCWhitelist(token1)).to.true;
      expect(await wl.OTCWhitelist(token2)).to.true;

      await wl.bunchChangeOTCWhitelist([token1], [false]);

      expect(await wl.OTCWhitelist(token1)).to.false;
    });

    it("should revert if array lengths are not equals", async () => {
      await expect(wl.bunchChangeOTCWhitelist([token1, token2], [true])).to.revertedWith(
        "Whitelist: arrays should be same",
      );
    });

    it("should revert if caller isn't owner", async () => {
      await expect(wl.connect(SECOND).bunchChangeOTCWhitelist([token1], [false])).revertedWithCustomError(
        wl,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("#bunchChangeUSDStables", () => {
    it("should add token to wl", async () => {
      await wl.bunchChangeUSDStables([token1], [true]);

      expect(await wl.USDStables(token1)).to.true;
      expect(await wl.USDStables(token2)).to.false;
    });

    it("should remove token from wl", async () => {
      await wl.bunchChangeUSDStables([token1, token2], [true, true]);

      expect(await wl.USDStables(token1)).to.true;
      expect(await wl.USDStables(token2)).to.true;

      await wl.bunchChangeUSDStables([token1], [false]);

      expect(await wl.USDStables(token1)).to.false;
    });

    it("should revert if array lengths are not equals", async () => {
      await expect(wl.bunchChangeUSDStables([token1, token2], [true])).to.revertedWith(
        "Whitelist: arrays should be same",
      );
    });

    it("should revert if caller isn't owner", async () => {
      await expect(wl.connect(SECOND).bunchChangeUSDStables([token1], [false])).revertedWithCustomError(
        wl,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
