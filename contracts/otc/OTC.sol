// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OTC {
    struct Trade {
        address creator;
        address buyer;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
    }

    uint256 public constant DENOMINATOR = 10 ** 27;

    uint256 public feeRate; // 10**27 = 100%
    address public treasury;

    Trade[] public trades;

    constructor(uint256 feeRate_, address treasury_) {
        feeRate = feeRate_;
        treasury = treasury_;
    }

    function getTrades(
        uint256 offset_,
        uint256 limit_
    ) external view returns (Trade[] memory list_) {
        uint256 to_ = getTo(trades.length, offset_, limit_);

        list_ = new Trade[](offset_ - limit_);

        for (uint256 i = offset_; i < to_; i++) {
            list_[i - offset_] = trades[i];
        }
    }

    function createTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_
    ) external returns (uint256) {
        require(tokenIn_ != address(0) && tokenOut_ != address(0), "OTC: token addresses are 0");
        require(tokenIn_ != tokenOut_, "OTC: same token addresses");
        require(amountIn_ != 0 && amountOut_ != 0, "OTC: amounts are 0");

        trades.push(Trade(msg.sender, address(0), tokenIn_, tokenOut_, amountIn_, amountOut_));

        IERC20(tokenIn_).transferFrom(msg.sender, address(this), amountIn_);

        return trades.length - 1;
    }

    function buy(uint256 tradeId_) external {
        Trade storage _trade = trades[tradeId_];

        require(_trade.buyer == address(0), "OTC: trade is already complete");
        require(_trade.creator != msg.sender, "OTC: creator can't buy");

        uint256 fee_ = (_trade.amountOut * feeRate) / DENOMINATOR;

        IERC20(_trade.tokenOut).transferFrom(msg.sender, treasury, fee_);
        IERC20(_trade.tokenOut).transferFrom(msg.sender, _trade.creator, _trade.amountOut - fee_);
        IERC20(_trade.tokenIn).transfer(msg.sender, _trade.amountIn);

        _trade.buyer = msg.sender;
    }

    function getTo(
        uint256 length_,
        uint256 offset_,
        uint256 limit_
    ) internal pure returns (uint256 to_) {
        to_ = offset_ + limit_;

        if (to_ > length_) {
            to_ = length_;
        }

        if (offset_ > to_) {
            to_ = offset_;
        }
    }
}
