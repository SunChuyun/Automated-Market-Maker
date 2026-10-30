// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Local test-only substitute: the student's existing MockPriceFeed.sol
// should be kept in the actual project. Do not deploy this file to Sepolia.
contract MockPriceFeed {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;
    bool public unavailable;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 newAnswer) external {
        answer = newAnswer;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 timestamp) external {
        updatedAt = timestamp;
    }

    function setUnavailable(bool status) external {
        unavailable = status;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        require(!unavailable, "Feed temporarily unavailable");
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
