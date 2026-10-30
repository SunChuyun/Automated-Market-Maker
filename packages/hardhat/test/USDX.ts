import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("USDX Token", function () {
  it("Should mint 1,000,000 USDX to the deployer", async function () {
    const [deployer] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");

    const expectedSupply = ethers.parseUnits("1000000", 18);

    expect(await usdx.totalSupply()).to.equal(expectedSupply);

    expect(await usdx.balanceOf(deployer.address)).to.equal(expectedSupply);
  });

  it("Should allow token transfers", async function () {
    const [, alice] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");

    const amount = ethers.parseUnits("100", 18);

    await usdx.transfer(alice.address, amount);

    expect(await usdx.balanceOf(alice.address)).to.equal(amount);
  });

  it("Should revert if balance is insufficient", async function () {
    const [deployer, alice] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");

    await expect(usdx.connect(alice).transfer(deployer.address, 1n)).to.be.revertedWithCustomError(
      usdx,
      "ERC20InsufficientBalance",
    );
  });
});
