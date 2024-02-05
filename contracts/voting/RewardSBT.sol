// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {SBT} from "@solarity/solidity-lib/tokens/SBT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardSBT is SBT, Ownable {
    uint256 public nextId;

    constructor(string memory name_, string memory symbol_, address owner) Ownable(owner) {
        __RewardSBT_init(name_, symbol_);
    }

    function __RewardSBT_init(string memory name_, string memory symbol_) private initializer {
        __SBT_init(name_, symbol_);
    }

    function mint(address to_) external onlyOwner {
        _mint(to_, nextId++);
    }
}
