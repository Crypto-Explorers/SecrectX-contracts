// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface ICommunityVoting {
    struct Proposal {
        string projectDescriptionLink;
        address token;
        address beneficiary;
        uint64 startTimestamp;
        address author;
        uint256 amount;
        uint256 votesFor;
        uint256 quorum;
    }

    function createProposal(
        string calldata projectDescriptionLink_,
        address token_,
        uint256 amount_,
        uint64 startTimestamp_,
        address beneficiary_
    ) external returns (uint256);

    function voteFor(uint256 proposalId_, uint256 tokenAmount_) external;

    function claim(uint256 proposalId_) external;

    function claimNFT(uint256 proposalId_) external;
}
