// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ITokenWhitelist} from "./interfaces/ITokenWhitelist.sol";

contract TokenWhitelist is Ownable, ITokenWhitelist {
    mapping(address => bool) public OTCWhitelist;
    mapping(address => bool) public USDStables;

    constructor() Ownable(msg.sender) {}

    function changeOTCWhitelist(address token, bool status) public onlyOwner {
        OTCWhitelist[token] = status;
    }

    function changeUSDStables(address token, bool status) public onlyOwner {
        USDStables[token] = status;
    }

    function bunchChangeOTCWhitelist(
        address[] calldata tokens,
        bool[] calldata statuses
    ) external onlyOwner {
        require(tokens.length == statuses.length, "Whitelist: arrays should be same");
        for (uint256 i; i < tokens.length; i++) {
            changeOTCWhitelist(tokens[i], statuses[i]);
        }
    }

    function bunchChangeUSDStables(
        address[] calldata tokens,
        bool[] calldata statuses
    ) external onlyOwner {
        require(tokens.length == statuses.length, "Whitelist: arrays should be same");
        for (uint256 i; i < tokens.length; i++) {
            changeUSDStables(tokens[i], statuses[i]);
        }
    }
}
