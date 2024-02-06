// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IIDOFactory} from "../interfaces/ido/IIDOFactory.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {TimeToHoldIDO} from "./TimeToHoldIDO.sol";

contract IDOFactory is IIDOFactory {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakeToken;

    event TimeToHoldDeployed(address ido);

    constructor(IERC20 stakeToken_) {
        stakeToken = stakeToken_;
    }

    function deployTimeToHoldIDO(
        IERC20 idoToken_,
        uint256 tokenAmount_,
        uint256 startTimestamp_,
        uint256 endStakeTimestamp_,
        uint256 endIDOTimestamp_,
        string memory projectDescriptionLink_
    ) external returns (address) {
        TimeToHoldIDO ido = new TimeToHoldIDO();

        idoToken_.safeTransferFrom(msg.sender, address(ido), tokenAmount_);

        ido.initialize(
            stakeToken,
            idoToken_,
            tokenAmount_,
            startTimestamp_,
            endStakeTimestamp_,
            endIDOTimestamp_,
            projectDescriptionLink_
        );

        emit TimeToHoldDeployed(address(ido));

        return address(ido);
    }
}
