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
    ITokenWhitelist public tokenWhitelist;

    Trade[] public trades;

    constructor(uint256 feeRate_, address treasury_, ITokenWhitelist tokenWhitelist_) {
        feeRate = feeRate_;
        treasury = treasury_;
        tokenWhitelist = tokenWhitelist_;
    }

    function createTrade(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn_,
        uint256 amountOut_,
        address buyer_
    ) external returns (uint256) {
        require(tokenIn_ != address(0) && tokenOut_ != address(0), "OTC: token addresses are 0");
        require(
            (tokenWhitelist.OTCWhitelist(tokenIn_) || tokenWhitelist.OTCWhitelist(tokenOut_)) &&
                (tokenWhitelist.USDStables(tokenIn_) || tokenWhitelist.USDStables(tokenOut_)),
            "OTC: tokens must be whitelisted"
        );
        require(tokenIn_ != tokenOut_, "OTC: same token addresses");
        require(amountIn_ != 0 && amountOut_ != 0, "OTC: amounts are 0");
        require(buyer_ != msg.sender, "OTC: creator can't be buyer");

        trades.push(Trade(msg.sender, buyer_, tokenIn_, tokenOut_, amountIn_, amountOut_, false));

        IERC20(tokenIn_).safeTransferFrom(msg.sender, address(this), amountIn_);

        return trades.length - 1;
    }

    function buy(uint256 tradeId_) external {
        Trade storage _trade = trades[tradeId_];

        require(!_trade.isClosed, "OTC: trade already completed");
        require(
            _trade.buyer == address(0) || _trade.buyer == msg.sender,
            "OTC: only selected buyer can buy"
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
}
