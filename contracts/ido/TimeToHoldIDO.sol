// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TimeToHoldIDO {
    using SafeERC20 for IERC20;

    IERC20 public stakeToken;
    IERC20 public idoToken;
    uint256 public totalStaked;
    uint256 public totalIDOTokens;
    uint256 public startTimestamp;
    uint256 public endStakeTimestamp;
    uint256 public endIDOTimestamp;
    string public projectDescriptionLink;

    bool public isInitialized;

    mapping(address => uint256) public stakedTokens;

    modifier duringStakePeriod() {
        require(
            block.timestamp >= startTimestamp && block.timestamp <= endStakeTimestamp,
            "IDO: Not in stake period"
        );
        _;
    }

    modifier afterIDOPeriod() {
        require(block.timestamp > endIDOTimestamp, "IDO: period not ended");
        _;
    }

    function stake(uint256 amount) external duringStakePeriod {
        require(amount > 0, "IDO: zero amount");

        stakedTokens[msg.sender] += amount;
        totalStaked += amount;

        IERC20(stakeToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    function unstake() external duringStakePeriod {
        uint256 amount = stakedTokens[msg.sender];
        require(amount > 0, "IDO: No tokens to unstake");

        stakedTokens[msg.sender] = 0;
        totalStaked -= amount;

        IERC20(stakeToken).safeTransfer(msg.sender, amount);
    }

    function claim() external afterIDOPeriod {
        uint256 userStake = stakedTokens[msg.sender];
        require(userStake > 0, "IDO: No tokens to claim");

        uint256 userIDOTokens = (userStake * totalIDOTokens) / totalStaked;

        stakedTokens[msg.sender] = 0;

        IERC20(idoToken).safeTransfer(msg.sender, userIDOTokens);
        IERC20(stakeToken).safeTransfer(msg.sender, userStake);
    }

    function initialize(
        IERC20 stakeToken_,
        IERC20 idoToken_,
        uint256 tokenAmount_,
        uint256 startTimestamp_,
        uint256 endStakeTimestamp_,
        uint256 endIDOTimestamp_,
        string memory projectDescriptionLink_
    ) external {
        require(!isInitialized, "IDO: initialized");

        stakeToken = stakeToken_;
        idoToken = idoToken_;
        totalIDOTokens = tokenAmount_;
        startTimestamp = startTimestamp_;
        endStakeTimestamp = endStakeTimestamp_;
        endIDOTimestamp = endIDOTimestamp_;
        projectDescriptionLink = projectDescriptionLink_;

        isInitialized = true;
    }
}
