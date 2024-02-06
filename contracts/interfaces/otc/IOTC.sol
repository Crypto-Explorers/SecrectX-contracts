// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IOTC {
    struct Trade {
        address creator;
        address buyer;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
    }

    function getTrades(
        uint256 offset_,
        uint256 limit_
    ) external view returns (Trade[] memory list_);

    function createTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_
    ) external returns (uint256);

    function buy(uint256 tradeId_) external;
}
