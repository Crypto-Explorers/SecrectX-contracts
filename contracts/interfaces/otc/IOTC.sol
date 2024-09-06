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
        uint64 startTimestamp;
        uint64 endTimestamp;
        bool isClosed;
    }

    event TradeCreated(
        uint256 tradeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint64 startTimestamp,
        uint64 endTimestamp,
        address seller,
        address buyer
    );
    event Bought(uint256 tradeId, address buyer);
    event TradeRejected(uint256 tradeId);

    function getTrades(
        uint256 offset_,
        uint256 limit_
    ) external view returns (Trade[] memory list_);

    function createSimpleTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        uint64 startTimestamp_,
        uint64 endTimestamp_
    ) external returns (uint256);

    function createTargetTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        uint64 startTimestamp_,
        uint64 endTimestamp_,
        address buyer_
    ) external returns (uint256);

    function buy(uint256 tradeId_) external;
}
