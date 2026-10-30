// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Test-only token. Burns 1% of each non-mint/non-burn transfer to verify
// that AMMPool refuses assets whose actual receipts differ from the amount.
contract MockFeeOnTransferToken is ERC20 {
    constructor() ERC20("Test Transfer Tax Token", "TAX") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        uint256 fee = amount / 100;
        super._update(from, address(0), fee);
        super._update(from, to, amount - fee);
    }
}
