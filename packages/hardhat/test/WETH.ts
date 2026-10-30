import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("WETH Token", function () {
  it("Should mint WETH when ETH is deposited", async function () {
    const [user] = await ethers.getSigners();
    const weth = await ethers.deployContract("WETH");

    const amount = ethers.parseEther("1");

    await weth.deposit({ value: amount });

    expect(await weth.balanceOf(user.address)).to.equal(amount);

    expect(await ethers.provider.getBalance(await weth.getAddress())).to.equal(amount);
  });

  it("Should return ETH when WETH is withdrawn", async function () {
    const [user] = await ethers.getSigners();
    const weth = await ethers.deployContract("WETH");

    await weth.deposit({ value: ethers.parseEther("1") });

    await weth.withdraw(ethers.parseEther("0.4"));

    expect(await weth.balanceOf(user.address)).to.equal(ethers.parseEther("0.6"));

    expect(await ethers.provider.getBalance(await weth.getAddress())).to.equal(ethers.parseEther("0.6"));
  });

  it("Should revert if WETH balance is insufficient", async function () {
    const weth = await ethers.deployContract("WETH");

    await expect(weth.withdraw(ethers.parseEther("1"))).to.be.revertedWithCustomError(weth, "ERC20InsufficientBalance");
  });

  it("Should reject zero deposits and withdrawals", async function () {
    const weth = await ethers.deployContract("WETH");

    await expect(weth.deposit()).to.be.revertedWith("Zero deposit");

    await expect(weth.withdraw(0n)).to.be.revertedWith("Zero withdrawal");
  });
});
