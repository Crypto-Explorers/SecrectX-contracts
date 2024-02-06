// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {ICommunityVoting} from "../interfaces/voting/ICommunityVoting.sol";
import {IRewardSBT} from "../interfaces/voting/IRewardSBT.sol";

contract CommunityVoting is Ownable, ICommunityVoting {
    using SafeERC20 for IERC20;

    IERC20 public votingToken;
    IRewardSBT public sbt;
    uint256 public quorum;
    uint256 public votingDuration;

    mapping(uint256 => mapping(address => uint256)) public votesFor; // proposalId => voterAddress => votes

    Proposal[] public proposals;

    constructor(
        IERC20 votingToken_,
        uint256 quorum_,
        uint256 votingDuration_
    ) Ownable(msg.sender) {
        votingToken = votingToken_;
        quorum = quorum_;
        votingDuration = votingDuration_;
    }

    function createProposal(
        string calldata projectDescriptionLink_,
        address token_,
        uint256 amount_,
        uint64 startTimestamp_,
        address beneficiary_
    ) external returns (uint256) {
        require(
            (token_ == address(0) && amount_ == 0) || (token_ != address(0) && amount_ != 0),
            "CV: token and amount both should be zero or not zero at the same time"
        );
        require(startTimestamp_ >= block.number, "CV: wrong start timestamp");

        proposals.push(
            Proposal(
                projectDescriptionLink_,
                token_,
                beneficiary_,
                startTimestamp_,
                msg.sender,
                amount_,
                0,
                quorum
            )
        );

        IERC20(token_).safeTransferFrom(msg.sender, address(this), amount_);

        return proposals.length - 1;
    }

    function voteFor(uint256 proposalId_, uint256 tokenAmount_) external {
        require(tokenAmount_ > 0, "CV: amount is zero");

        Proposal storage _proposal = proposals[proposalId_];

        require(_proposal.startTimestamp + votingDuration < block.timestamp, "CV: voting ended");
        require(_proposal.author != msg.sender, "CV: author can't vote");

        _proposal.votesFor += tokenAmount_;
        votesFor[proposalId_][msg.sender] += tokenAmount_;

        votingToken.transferFrom(msg.sender, address(this), tokenAmount_);
    }

    function claim(uint256 proposalId_) external {
        Proposal storage _proposal = proposals[proposalId_];

        require(
            _proposal.startTimestamp + votingDuration >= block.number,
            "CV: voting should be ended"
        );
        require(_proposal.votesFor >= _proposal.quorum, "CV: quorum should be reached");

        uint256 voteAmount_ = votesFor[proposalId_][msg.sender];

        require(voteAmount_ > 0, "CV: zero vote amount");

        votingToken.transfer(msg.sender, voteAmount_);

        uint256 rewardTokens_ = (voteAmount_ * _proposal.amount) / _proposal.votesFor;

        votesFor[proposalId_][msg.sender] = 0;

        IERC20(_proposal.token).safeTransfer(msg.sender, rewardTokens_);
        votingToken.transfer(msg.sender, voteAmount_);
    }

    function claimNFT(uint256 proposalId_) external {
        Proposal storage _proposal = proposals[proposalId_];

        require(
            _proposal.startTimestamp + votingDuration >= block.number,
            "CV: voting should be ended"
        );
        require(_proposal.votesFor >= _proposal.quorum, "CV: quorum should be reached");

        sbt.mint(_proposal.beneficiary);
    }
}
