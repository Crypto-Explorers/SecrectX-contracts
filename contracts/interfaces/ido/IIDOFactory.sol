// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IIDOFactory {
    function deployTimeToHoldIDO(
        IERC20 idoToken_,
        uint256 tokenAmount_,
        uint256 startTimestamp_,
        uint256 endStakeTimestamp_,
        uint256 endIDOTimestamp_,
        string memory projectDescriptionLink_
    ) external returns (address);
}
