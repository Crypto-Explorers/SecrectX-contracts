import { ethers } from "hardhat";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { DECIMAL, ZERO_ADDR } from "@/scripts/utils/constants";
import { CommunityVoting, ERC20Mock, RewardSBT } from "@ethers-v6";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { beforeEach } from "mocha";

describe("CommunityVoting", () => {
  const reverter = new Reverter();

  const quorum = 10n * DECIMAL;
  const duration = 100;
  const startTimestamp = Math.floor(Date.now() / 1000) + 100;

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;
  let votingToken: ERC20Mock;
  let projectToken: ERC20Mock;
  let sbt: RewardSBT;

  let communityVoting: CommunityVoting;

  beforeEach(async () => {
    [FIRST, SECOND, THIRD] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    votingToken = await ERC20.deploy("Voting Token", "VOT", 18);

    projectToken = await ERC20.deploy("Community Token", "COT", 18);

    const SBT = await ethers.getContractFactory("RewardSBT");
    sbt = await SBT.deploy("NFt", "SBT", FIRST.address);

    const CommunityVoting = await ethers.getContractFactory("CommunityVoting");
    communityVoting = await CommunityVoting.deploy(votingToken, sbt, quorum, duration);

    await sbt.transferOwnership(communityVoting);

    await votingToken.mint(SECOND.address, 10n * DECIMAL);
    await votingToken.connect(SECOND).approve(await communityVoting.getAddress(), 10n * DECIMAL);

    await projectToken.mint(FIRST.address, 100n * DECIMAL);
    await projectToken.approve(await communityVoting.getAddress(), 100n * DECIMAL);

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("#deployment", () => {
    it("should check deployment parameters", async () => {
      expect(await communityVoting.votingToken()).to.eq(await votingToken.getAddress());
      expect(await communityVoting.quorum()).to.eq(quorum);
      expect(await communityVoting.votingDuration()).to.eq(duration);
    });
  });

  describe("#createProposal", () => {
    it("should create a new proposal", async () => {
      const proposalId = await communityVoting.createProposal.staticCall(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );

      await communityVoting.createProposal(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );

      expect(proposalId).to.eq(0);
      expect((await communityVoting.proposals(0)).projectDescriptionLink).to.eq("https://www.google.com");
      expect((await communityVoting.proposals(0)).token).to.eq(await projectToken.getAddress());
      expect((await communityVoting.proposals(0)).beneficiary).to.eq(THIRD.address);
      expect((await communityVoting.proposals(0)).startTimestamp).to.eq(startTimestamp);
      expect((await communityVoting.proposals(0)).author).to.eq(FIRST.address);
      expect((await communityVoting.proposals(0)).amount).to.eq(100n * DECIMAL);
      expect((await communityVoting.proposals(0)).votesFor).to.eq(0);
      expect((await communityVoting.proposals(0)).quorum).to.eq(quorum);

      expect(await projectToken.balanceOf(await communityVoting.getAddress())).to.eq(100n * DECIMAL);
    });

    it("should create a proposal with zero address and amount", async () => {
      const proposalId = await communityVoting.createProposal.staticCall(
        "https://www.google.com",
        ZERO_ADDR,
        0,
        startTimestamp,
        THIRD.address,
      );

      await communityVoting.createProposal("https://www.google.com", ZERO_ADDR, 0, startTimestamp, THIRD.address);

      expect((await communityVoting.proposals(0)).projectDescriptionLink).to.eq("https://www.google.com");
      expect((await communityVoting.proposals(0)).token).to.eq(ZERO_ADDR);
      expect((await communityVoting.proposals(0)).beneficiary).to.eq(THIRD.address);
      expect((await communityVoting.proposals(0)).startTimestamp).to.eq(startTimestamp);
      expect((await communityVoting.proposals(0)).author).to.eq(FIRST.address);
      expect((await communityVoting.proposals(0)).amount).to.eq(0);
      expect((await communityVoting.proposals(0)).votesFor).to.eq(0);
      expect((await communityVoting.proposals(0)).quorum).to.eq(quorum);

      expect(await votingToken.balanceOf(await communityVoting.getAddress())).to.eq(0);
    });

    it("should revert if token and amount both are zero", async () => {
      await expect(
        communityVoting.createProposal("https://www.google.com", ZERO_ADDR, 1, startTimestamp, THIRD.address),
      ).to.be.revertedWith("CV: token and amount both should be zero or not zero at the same time");

      await expect(
        communityVoting.createProposal(
          "https://www.google.com",
          await votingToken.getAddress(),
          0,
          startTimestamp,
          THIRD.address,
        ),
      ).to.be.revertedWith("CV: token and amount both should be zero or not zero at the same time");
    });

    it("should revert if startTimestamp < block.timestamp", async () => {
      await expect(
        communityVoting.createProposal("https://www.google.com", await votingToken.getAddress(), 1, 0, THIRD.address),
      ).to.be.revertedWith("CV: wrong start timestamp");
    });
  });

  describe("#voteFor", () => {
    let proposalId: bigint;

    beforeEach(async () => {
      proposalId = await communityVoting.createProposal.staticCall(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );

      await communityVoting.createProposal(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );
    });

    it("allows users to vote for a proposal", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      expect(await communityVoting.votesFor(proposalId, SECOND.address)).to.equal(0);

      await communityVoting.connect(SECOND).voteFor(proposalId, 5n * DECIMAL);

      expect(await communityVoting.votesFor(proposalId, SECOND.address)).to.equal(5n * DECIMAL);
      expect((await communityVoting.proposals(proposalId)).votesFor).to.equal(5n * DECIMAL);
      expect(await votingToken.balanceOf(await communityVoting.getAddress())).to.equal(5n * DECIMAL);
    });

    it("should revert if vote amount is zero", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.connect(SECOND).voteFor(proposalId, 0n)).to.be.revertedWith("CV: amount is zero");
    });

    it("should revert if startTimestamp > block.timestamp", async () => {
      await expect(communityVoting.connect(SECOND).voteFor(proposalId, SECOND.address)).to.be.revertedWith(
        "CV: voting not started",
      );
    });

    it("should revert if voting ended", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.connect(SECOND).voteFor(proposalId, SECOND.address)).to.be.revertedWith(
        "CV: voting ended",
      );
    });

    it("should revert if sender is proposal author", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.voteFor(proposalId, FIRST.address)).to.be.revertedWith("CV: author can't vote");
    });
  });

  describe("#claim", () => {
    let proposalId: bigint;

    beforeEach(async () => {
      proposalId = await communityVoting.createProposal.staticCall(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );

      await communityVoting.createProposal(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );
    });

    it("allows users to claim their voting tokens after a proposal has ended", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 10n * DECIMAL);

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).claim(proposalId);

      expect(await communityVoting.votesFor(proposalId, SECOND.address)).to.eq(0n);
      expect(await votingToken.balanceOf(SECOND.address)).to.eq(10n * DECIMAL);
      expect(await projectToken.balanceOf(SECOND.address)).to.eq(100n * DECIMAL);
    });

    it("reverts if a user tries to claim voting tokens for a proposal that has not ended", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 10n * DECIMAL);

      await expect(communityVoting.connect(SECOND).claim(proposalId)).to.be.revertedWith("CV: voting should be ended");
    });

    it("reverts if a user tries to claim voting tokens for a proposal that did not reach quorum", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 5n * DECIMAL);

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.connect(SECOND).claim(proposalId)).to.be.revertedWith(
        "CV: quorum should be reached",
      );
    });

    it("should revert if vote amount is zero", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 10n * DECIMAL);

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.connect(THIRD).claim(proposalId)).to.be.revertedWith("CV: zero vote amount");
    });
  });

  describe("#claimNFT", () => {
    let proposalId: bigint;

    beforeEach(async () => {
      proposalId = await communityVoting.createProposal.staticCall(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );

      await communityVoting.createProposal(
        "https://www.google.com",
        await projectToken.getAddress(),
        100n * DECIMAL,
        startTimestamp,
        THIRD.address,
      );
    });

    it("should claim nft", async () => {
      const proposalStruct = await communityVoting.proposals(proposalId);
      const nextId = await sbt.nextId();

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 10n * DECIMAL);

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await communityVoting.claimNFT(proposalId);

      expect(await sbt.balanceOf(proposalStruct.beneficiary)).to.eq(1);
      expect(await sbt.ownerOf(nextId)).to.eq(proposalStruct.beneficiary);
    });

    it("should revert if voting not ended", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 10n * DECIMAL);

      await expect(communityVoting.claimNFT(proposalId)).to.be.revertedWith("CV: voting should be ended");
    });

    it("should revert if quorum haven't reached", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp]);
      await ethers.provider.send("evm_mine");

      await communityVoting.connect(SECOND).voteFor(proposalId, 5n * DECIMAL);

      await ethers.provider.send("evm_setNextBlockTimestamp", [startTimestamp + duration]);
      await ethers.provider.send("evm_mine");

      await expect(communityVoting.claimNFT(proposalId)).to.be.revertedWith("CV: quorum should be reached");
    });
  });
});
