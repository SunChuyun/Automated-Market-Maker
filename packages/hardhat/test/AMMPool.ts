import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AMMPool", function () {
  // =========================================================
  // Test 1: Initial Liquidity
  // =========================================================

  it("Should mint LP tokens when initial liquidity is added", async function () {
    const [alice] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    const wethAmount = ethers.parseEther("1");
    const usdxAmount = ethers.parseUnits("2500", 18);

    // Alice wraps 1 ETH into WETH
    await weth.deposit({ value: wethAmount });

    // Approve AMM pool to transfer tokens
    await weth.approve(poolAddress, wethAmount);
    await usdx.approve(poolAddress, usdxAmount);

    // Add initial liquidity
    await pool.addLiquidity(wethAmount, usdxAmount, ethers.parseEther("50"), ethers.MaxUint256);

    // Verify reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(wethAmount);
    expect(reserves[1]).to.equal(usdxAmount);

    // Initial LP shares = sqrt(1 * 2500) = 50
    expect(await pool.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));

    expect(await pool.totalSupply()).to.equal(ethers.parseEther("50"));
  });

  // =========================================================
  // Test 2: Second LP
  // =========================================================

  it("Should mint proportional shares for a second LP", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    // Alice adds 1 WETH + 2500 USDX
    const weth1 = ethers.parseEther("1");
    const usdx1 = ethers.parseUnits("2500", 18);

    await weth.connect(alice).deposit({ value: weth1 });

    await weth.connect(alice).approve(poolAddress, weth1);
    await usdx.connect(alice).approve(poolAddress, usdx1);

    await pool.connect(alice).addLiquidity(weth1, usdx1, 1n, ethers.MaxUint256);

    // Bob adds 0.5 WETH + 1250 USDX
    const weth2 = ethers.parseEther("0.5");
    const usdx2 = ethers.parseUnits("1250", 18);

    // Transfer USDX to Bob
    await usdx.transfer(bob.address, usdx2);

    // Bob wraps ETH into WETH
    await weth.connect(bob).deposit({ value: weth2 });

    await weth.connect(bob).approve(poolAddress, weth2);
    await usdx.connect(bob).approve(poolAddress, usdx2);

    await pool.connect(bob).addLiquidity(weth2, usdx2, 1n, ethers.MaxUint256);

    // Bob should receive 25 LP tokens
    expect(await pool.balanceOf(bob.address)).to.equal(ethers.parseEther("25"));

    // Total LP supply should be 75
    expect(await pool.totalSupply()).to.equal(ethers.parseEther("75"));

    // Check updated reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(ethers.parseEther("1.5"));

    expect(reserves[1]).to.equal(ethers.parseUnits("3750", 18));
  });

  // =========================================================
  // Test 3: Remove Liquidity
  // =========================================================

  it("Should return proportional assets when LP tokens are burned", async function () {
    const [alice] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    const wethAmount = ethers.parseEther("1");
    const usdxAmount = ethers.parseUnits("2500", 18);

    // Alice provides initial liquidity
    await weth.deposit({ value: wethAmount });

    await weth.approve(poolAddress, wethAmount);
    await usdx.approve(poolAddress, usdxAmount);

    await pool.addLiquidity(wethAmount, usdxAmount, 1n, ethers.MaxUint256);

    // Alice initially owns 50 LP tokens
    expect(await pool.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));

    // Burn half of the LP tokens
    await pool.removeLiquidity(
      ethers.parseEther("25"),
      ethers.parseEther("0.5"),
      ethers.parseUnits("1250", 18),
      ethers.MaxUint256,
    );

    // Alice should have 25 LP tokens remaining
    expect(await pool.balanceOf(alice.address)).to.equal(ethers.parseEther("25"));

    expect(await pool.totalSupply()).to.equal(ethers.parseEther("25"));

    // Pool reserves should decrease by 50%
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(ethers.parseEther("0.5"));

    expect(reserves[1]).to.equal(ethers.parseUnits("1250", 18));

    // Alice receives her underlying assets
    expect(await weth.balanceOf(alice.address)).to.equal(ethers.parseEther("0.5"));

    expect(await usdx.balanceOf(alice.address)).to.equal(ethers.parseUnits("998750", 18));
  });

  // =========================================================
  // Test 4: Swap WETH -> USDX
  // =========================================================

  it("Should swap WETH for USDX and collect fees", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    const initialWeth = ethers.parseEther("1");
    const initialUsdx = ethers.parseUnits("2500", 18);

    // Alice provides initial liquidity
    await weth.connect(alice).deposit({
      value: initialWeth,
    });

    await weth.connect(alice).approve(poolAddress, initialWeth);

    await usdx.connect(alice).approve(poolAddress, initialUsdx);

    await pool.connect(alice).addLiquidity(initialWeth, initialUsdx, 1n, ethers.MaxUint256);

    // Bob swaps 0.1 WETH for USDX
    const amountIn = ethers.parseEther("0.1");

    await weth.connect(bob).deposit({
      value: amountIn,
    });

    await weth.connect(bob).approve(poolAddress, amountIn);

    // Calculate expected output with 0.30% fee
    const effectiveInput = (amountIn * 9970n) / 10000n;

    const expectedOut = (initialUsdx * effectiveInput) / (initialWeth + effectiveInput);

    // Execute swap
    await pool.connect(bob).swapExactWethForUsdx(amountIn, expectedOut, ethers.MaxUint256);

    // Bob should receive the expected USDX
    expect(await usdx.balanceOf(bob.address)).to.equal(expectedOut);

    // Protocol fee = 0.05% of 0.1 WETH
    expect(await pool.protocolFeesWeth()).to.equal(ethers.parseEther("0.00005"));

    // Check updated reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(ethers.parseEther("1.09995"));

    expect(reserves[1]).to.equal(initialUsdx - expectedOut);

    // Actual balance = LP reserves + protocol fees
    expect(await weth.balanceOf(poolAddress)).to.equal(reserves[0] + (await pool.protocolFeesWeth()));
  });

  // =========================================================
  // Test 5: Swap USDX -> WETH
  // =========================================================

  it("Should swap USDX for WETH and collect fees", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    const initialWeth = ethers.parseEther("1");
    const initialUsdx = ethers.parseUnits("2500", 18);

    // Alice provides initial liquidity
    await weth.connect(alice).deposit({
      value: initialWeth,
    });

    await weth.connect(alice).approve(poolAddress, initialWeth);

    await usdx.connect(alice).approve(poolAddress, initialUsdx);

    await pool.connect(alice).addLiquidity(initialWeth, initialUsdx, 1n, ethers.MaxUint256);

    // Bob receives 100 USDX
    const amountIn = ethers.parseUnits("100", 18);

    await usdx.transfer(bob.address, amountIn);

    await usdx.connect(bob).approve(poolAddress, amountIn);

    // Calculate expected output with 0.30% fee
    const effectiveInput = (amountIn * 9970n) / 10000n;

    const expectedOut = (initialWeth * effectiveInput) / (initialUsdx + effectiveInput);

    // Execute swap
    await pool.connect(bob).swapExactUsdxForWeth(amountIn, expectedOut, ethers.MaxUint256);

    // Bob should receive the expected WETH
    expect(await weth.balanceOf(bob.address)).to.equal(expectedOut);

    // Protocol fee = 0.05% of 100 USDX
    expect(await pool.protocolFeesUsdx()).to.equal(ethers.parseUnits("0.05", 18));

    // Check updated reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(initialWeth - expectedOut);

    expect(reserves[1]).to.equal(ethers.parseUnits("2599.95", 18));

    // Actual balance = LP reserves + protocol fees
    expect(await usdx.balanceOf(poolAddress)).to.equal(reserves[1] + (await pool.protocolFeesUsdx()));
  });

  it("Should accrue LP fees and separate protocol fees", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    const initialWeth = ethers.parseEther("1");
    const initialUsdx = ethers.parseUnits("2500", 18);

    // Alice provides initial liquidity
    await weth.connect(alice).deposit({
      value: initialWeth,
    });

    await weth.connect(alice).approve(poolAddress, initialWeth);

    await usdx.connect(alice).approve(poolAddress, initialUsdx);

    await pool.connect(alice).addLiquidity(initialWeth, initialUsdx, 1n, ethers.MaxUint256);

    // Initial constant product
    const initialK = initialWeth * initialUsdx;

    // Bob swaps 0.1 WETH
    const amountIn = ethers.parseEther("0.1");

    await weth.connect(bob).deposit({
      value: amountIn,
    });

    await weth.connect(bob).approve(poolAddress, amountIn);

    await pool.connect(bob).swapExactWethForUsdx(amountIn, 1n, ethers.MaxUint256);

    // Protocol fee = 0.05%
    const protocolFee = (amountIn * 5n) / 10000n;

    expect(await pool.protocolFeesWeth()).to.equal(protocolFee);

    // Pool reserves should exclude protocol fees
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(initialWeth + amountIn - protocolFee);

    // LP fees should increase the constant product
    const newK = reserves[0] * reserves[1];

    expect(newK > initialK).to.equal(true);

    // Alice withdraws all her LP shares
    const aliceShares = await pool.balanceOf(alice.address);

    await pool.connect(alice).removeLiquidity(aliceShares, 1n, 1n, ethers.MaxUint256);

    // Alice receives all LP-owned reserves
    expect(await weth.balanceOf(alice.address)).to.equal(initialWeth + amountIn - protocolFee);

    // Pool reserves should now be zero
    const finalReserves = await pool.getReserves();

    expect(finalReserves[0]).to.equal(0n);
    expect(finalReserves[1]).to.equal(0n);

    // Protocol fee remains in the contract
    expect(await weth.balanceOf(poolAddress)).to.equal(protocolFee);
  });
});
