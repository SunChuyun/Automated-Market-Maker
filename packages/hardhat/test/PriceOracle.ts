import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("PriceOracle", function () {
  it("Should read and normalize ETH/USD price", async function () {
    // ETH/USD = $2500 with 8 decimals
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);

    // Maximum price age = 1 hour
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 3600n]);

    // Price should be converted to 18 decimals
    expect(await oracle.getEthUsdPrice18()).to.equal(ethers.parseEther("2500"));
  });

  it("Should reject zero and negative prices", async function () {
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);

    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 3600n]);

    // Zero price
    await mockFeed.setAnswer(0n);

    await expect(oracle.getEthUsdPrice18()).to.be.revertedWith("Invalid oracle price");

    // Negative price
    await mockFeed.setAnswer(-100n);

    await expect(oracle.getEthUsdPrice18()).to.be.revertedWith("Invalid oracle price");
  });

  it("Should reject stale and invalid timestamps", async function () {
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);

    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 3600n]);

    // Simulate an extremely old update
    await mockFeed.setUpdatedAt(1n);

    await expect(oracle.getEthUsdPrice18()).to.be.revertedWith("Stale oracle price");

    // Simulate a future timestamp
    await mockFeed.setUpdatedAt(ethers.MaxUint256);

    await expect(oracle.getEthUsdPrice18()).to.be.revertedWith("Invalid oracle timestamp");
  });
});
