// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ITokenWhitelist {
    function changeOTCWhitelist(address token, bool status) external;
    function changeUSDStables(address token, bool status) external;
    function bunchChangeOTCWhitelist(address[] calldata tokens, bool[] calldata statuses) external;
    function bunchChangeUSDStables(address[] calldata tokens, bool[] calldata statuses) external;

    function OTCWhitelist(address) external returns (bool);
    function USDStables(address) external returns (bool);
}
