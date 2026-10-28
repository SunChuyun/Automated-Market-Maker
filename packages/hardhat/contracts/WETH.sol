// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WETH is ERC20, ReentrancyGuard {

	event Deposit(address indexed user, uint256 amount);
	event Withdrawal(address indexed user, uint256 amount);

	constructor() ERC20("Wrapped Test Ether", "WETH") {}

	// Deposit ETH and receive WETH
	function deposit() public payable {
	    require(msg.value > 0, "Zero deposit");

	    _mint(msg.sender, msg.value);

	    emit Deposit(msg.sender, msg.value);
	}

	// Burn WETH and receive ETH
	function withdraw(uint256 amount) external nonReentrant {
	    require(amount > 0, "Zero withdrawal");

	    _burn(msg.sender, amount);

	    (bool success, ) = payable(msg.sender).call{value: amount}("");
	    require(success, "ETH transfer failed");

	    emit Withdrawal(msg.sender, amount);
	}

	// Allow users to send ETH directly
	receive() external payable {
	    deposit();
	}
}
