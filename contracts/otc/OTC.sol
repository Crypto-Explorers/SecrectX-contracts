// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ITokenWhitelist} from "../interfaces/ITokenWhitelist.sol";
import {IOTC} from "../interfaces/otc/IOTC.sol";

contract OTC is IOTC {
    using SafeERC20 for IERC20;

    uint256 public constant DENOMINATOR = 10 ** 27;

    uint256 public feeRate; // 10**27 = 100%
    address public treasury;

    Trade[] public trades;

    constructor(uint256 feeRate_, address treasury_) {
        feeRate = feeRate_;
        treasury = treasury_;
    }

    function createSimpleTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        uint64 startTimestamp_,
        uint64 endTimestamp_
    ) external returns (uint256) {
        return
            _createTrade(
                tokenIn_,
                tokenOut_,
                amountIn_,
                amountOut_,
                startTimestamp_,
                endTimestamp_,
                address(0)
            );
    }

    function createTargetTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        uint64 startTimestamp_,
        uint64 endTimestamp_,
        address buyer_
    ) external returns (uint256) {
        return
            _createTrade(
                tokenIn_,
                tokenOut_,
                amountIn_,
                amountOut_,
                startTimestamp_,
                endTimestamp_,
                buyer_
            );
    }

    function buy(uint256 tradeId_) external {
        Trade storage _trade = trades[tradeId_];

        require(!_trade.isClosed, "OTC: trade already completed");
        require(
            _trade.buyer == address(0) || _trade.buyer == msg.sender,
            "OTC: only selected buyer can buy"
        );
        require(
            _trade.startTimestamp <= block.timestamp && _trade.endTimestamp > block.timestamp,
            "OTC: not started or expired"
        );

        uint256 fee_ = (_trade.amountOut * feeRate) / DENOMINATOR;

        _trade.isClosed = true;

        IERC20(_trade.tokenOut).safeTransferFrom(msg.sender, treasury, fee_);
        IERC20(_trade.tokenOut).safeTransferFrom(
            msg.sender,
            _trade.creator,
            _trade.amountOut - fee_
        );

        IERC20(_trade.tokenIn).safeTransfer(msg.sender, _trade.amountIn);

        if (_trade.buyer == address(0)) {
            _trade.buyer = msg.sender;
        }

        emit Bought(tradeId_, msg.sender);
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

    function _createTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        uint64 startTimestamp_,
        uint64 endTimestamp_,
        address buyer_
    ) internal returns (uint256) {
        require(tokenIn_ != address(0) && tokenOut_ != address(0), "OTC: token addresses are 0");
        require(tokenIn_ != tokenOut_, "OTC: same token addresses");
        require(amountIn_ != 0 && amountOut_ != 0, "OTC: amounts are 0");
        require(buyer_ != msg.sender, "OTC: creator can't be buyer");
        require(
            startTimestamp_ >= block.timestamp && startTimestamp_ < endTimestamp_,
            "OTC: timestamps is in past"
        );

        trades.push(
            Trade(
                msg.sender,
                buyer_,
                tokenIn_,
                tokenOut_,
                amountIn_,
                amountOut_,
                startTimestamp_,
                endTimestamp_,
                false
            )
        );

        IERC20(tokenIn_).safeTransferFrom(msg.sender, address(this), amountIn_);

        emit TradeCreated(
            trades.length - 1,
            tokenIn_,
            tokenOut_,
            amountIn_,
            amountOut_,
            startTimestamp_,
            endTimestamp_,
            msg.sender,
            buyer_
        );

        return trades.length - 1;
    }
}
