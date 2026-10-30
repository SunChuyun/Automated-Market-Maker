import { expect } from "chai";
import { network } from "hardhat";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, ethers } = await network.create();

describe("AMM deployment scripts", function () {
  it("Should configure the local AMM stack without finalizing settings or adding liquidity", async function () {
    // Execute the same Rocketh deployment scripts used on Sepolia, but with
    // a mock ETH/USD feed on the in-memory Hardhat chain.
    const env = await loadAndExecuteDeploymentsFromFiles({ provider });

    const poolDeployment = env.get("AMMPool");
    const oracleDeployment = env.get("PriceOracle");
    const wethDeployment = env.get("WETH");
    const usdxDeployment = env.get("USDX");

    const pool = await ethers.getContractAt("AMMPool", poolDeployment.address);
    const oracle = await ethers.getContractAt("PriceOracle", oracleDeployment.address);

    expect((await pool.weth()).toLowerCase()).to.equal(wethDeployment.address.toLowerCase());
    expect((await pool.usdx()).toLowerCase()).to.equal(usdxDeployment.address.toLowerCase());
    expect((await pool.owner()).toLowerCase()).to.equal(env.namedAccounts.deployer.toLowerCase());
    expect((await pool.priceOracle()).toLowerCase()).to.equal(oracleDeployment.address.toLowerCase());
    expect(await pool.dynamicFeesEnabled()).to.equal(true);
    expect(await pool.settingsFinalized()).to.equal(false);
    expect(await pool.totalSupply()).to.equal(0n);

    expect(await oracle.maxAge()).to.equal(5400n);
    expect(await oracle.getEthUsdPrice18()).to.equal(ethers.parseEther("2500"));
  });
});
