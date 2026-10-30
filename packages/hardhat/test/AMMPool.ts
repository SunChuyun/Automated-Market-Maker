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

  it("Should seed the agreed 0.01 WETH and 25 USDX at the local $2500 oracle price", async function () {
    const [deployer] = await ethers.getSigners();
    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);
    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const wethAmount = ethers.parseEther("0.01");
    const oraclePrice = await oracle.getEthUsdPrice18();
    const usdxAmount = (wethAmount * oraclePrice) / 10n ** 18n;
    expect(usdxAmount).to.equal(ethers.parseEther("25"));

    await weth.deposit({ value: wethAmount });
    await weth.approve(await pool.getAddress(), wethAmount);
    await usdx.approve(await pool.getAddress(), usdxAmount);
    await pool.addLiquidity(wethAmount, usdxAmount, ethers.parseEther("0.5"), ethers.MaxUint256);

    expect(await pool.balanceOf(deployer.address)).to.equal(ethers.parseEther("0.5"));
    expect(await pool.getReserves()).to.deep.equal([wethAmount, usdxAmount]);
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

    // Full 0.05% goes to treasury; 0.25% is retained in LP reserves.
    expect(await pool.protocolFeesWeth()).to.equal(ethers.parseEther("0.00005"));

    // Check updated reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(ethers.parseEther("1.09995"));

    expect(reserves[1]).to.equal(initialUsdx - expectedOut);

    // Actual balance = LP reserves + treasury fees.
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

    expect(await pool.protocolFeesUsdx()).to.equal(ethers.parseUnits("0.05", 18));

    // Check updated reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(initialWeth - expectedOut);

    expect(reserves[1]).to.equal(ethers.parseUnits("2599.95", 18));

    // Actual balance = LP reserves + treasury fees.
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

    // Total non-LP allocation is always 0.05%.
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

    // Only treasury fees remain after all LP shares are redeemed.
    expect(await weth.balanceOf(poolAddress)).to.equal(protocolFee);
  });

  it("Should reject invalid swaps and LP withdrawals", async function () {
    const [, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    // Reject zero swap amount
    await expect(pool.swapExactWethForUsdx(0n, 1n, ethers.MaxUint256)).to.be.revertedWith("Zero swap amount");

    // Reject swaps when the pool has no liquidity
    await expect(pool.swapExactWethForUsdx(ethers.parseEther("1"), 1n, ethers.MaxUint256)).to.be.revertedWith(
      "Insufficient liquidity",
    );

    // Bob owns no LP tokens and cannot withdraw
    await expect(
      pool.connect(bob).removeLiquidity(ethers.parseEther("1"), 0n, 0n, ethers.MaxUint256),
    ).to.be.revertedWith("Insufficient LP shares");
  });

  it("Should enforce slippage protection and deadline", async function () {
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

    // Bob prepares to swap 0.1 WETH
    const amountIn = ethers.parseEther("0.1");

    await weth.connect(bob).deposit({
      value: amountIn,
    });

    await weth.connect(bob).approve(poolAddress, amountIn);

    // Calculate expected output
    const expectedOut = await pool.getAmountOut(amountIn, initialWeth, initialUsdx);

    // Slippage test: Bob demands more than the pool can provide
    await expect(
      pool.connect(bob).swapExactWethForUsdx(amountIn, expectedOut + 1n, ethers.MaxUint256),
    ).to.be.revertedWith("Insufficient output");

    // Bob should still own his original WETH
    expect(await weth.balanceOf(bob.address)).to.equal(amountIn);

    // Deadline test: transaction has already expired
    await expect(pool.connect(bob).swapExactWethForUsdx(amountIn, 1n, 1n)).to.be.revertedWith("Transaction expired");

    // Failed transactions must not change pool reserves
    const reserves = await pool.getReserves();

    expect(reserves[0]).to.equal(initialWeth);
    expect(reserves[1]).to.equal(initialUsdx);
  });

  it("Should select the correct dynamic trading fee", async function () {
    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    // Low deviation: base fee
    expect(await pool.calculateFeeBps(0n)).to.equal(30n);
    expect(await pool.calculateFeeBps(99n)).to.equal(30n);

    // At threshold: high fee
    expect(await pool.calculateFeeBps(100n)).to.equal(50n);

    // Above threshold: high fee
    expect(await pool.calculateFeeBps(300n)).to.equal(50n);
    expect(await pool.calculateFeeBps(500n)).to.equal(50n);
  });

  it("Should calculate dynamic fees using oracle prices", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    // Mock Chainlink price: $2500
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);

    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    // Alice provides 1 WETH + 2500 USDX
    const wethAmount = ethers.parseEther("1");
    const usdxAmount = ethers.parseUnits("2500", 18);

    await weth.connect(alice).deposit({
      value: wethAmount,
    });

    await weth.connect(alice).approve(poolAddress, wethAmount);

    await usdx.connect(alice).approve(poolAddress, usdxAmount);

    await pool.connect(alice).addLiquidity(wethAmount, usdxAmount, 1n, ethers.MaxUint256);

    // Configure oracle
    await pool.connect(alice).setPriceOracle(await oracle.getAddress());

    // Enable dynamic fees
    await pool.connect(alice).setDynamicFeesEnabled(true);

    // Pool and oracle both indicate $2500
    expect(await pool.getPriceDeviationBps()).to.equal(0n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    // Change oracle price to $2000
    await mockFeed.setAnswer(200000000000n);

    // Deviation: (2500 - 2000) / 2000 = 25% = 2500 bps
    expect(await pool.getPriceDeviationBps()).to.equal(2500n);

    // Oracle deviation is ignored during the 30-minute TWAP warm-up.
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.getCurrentFeeBps()).to.equal(50n);

    // Bob cannot disable dynamic fees
    await expect(pool.connect(bob).setDynamicFeesEnabled(false)).to.revert(ethers);

    // Stale data activates the spot/TWAP-only fallback.
    await mockFeed.setUpdatedAt(1n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    expect((await pool.getDynamicFeeStatus())[2]).to.equal(true);
  });

  it("Should apply dynamic fees to actual swaps", async function () {
    const [alice, bob] = await ethers.getSigners();

    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");

    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const poolAddress = await pool.getAddress();

    // Mock Chainlink ETH/USD price: $2500
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);

    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    // Alice provides initial liquidity
    const initialWeth = ethers.parseEther("1");
    const initialUsdx = ethers.parseUnits("2500", 18);

    await weth.connect(alice).deposit({
      value: initialWeth,
    });

    await weth.connect(alice).approve(poolAddress, initialWeth);

    await usdx.connect(alice).approve(poolAddress, initialUsdx);

    await pool.connect(alice).addLiquidity(initialWeth, initialUsdx, 1n, ethers.MaxUint256);

    // Configure and enable oracle-based dynamic fees
    await pool.connect(alice).setPriceOracle(await oracle.getAddress());

    await pool.connect(alice).setDynamicFeesEnabled(true);

    // Initially both prices are $2500: base fee
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    // Change oracle price to $2000
    await mockFeed.setAnswer(200000000000n);

    // Before TWAP is ready, even a 25% Chainlink deviation stays at base fee.
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    // Deviation exceeds the 1% TWAP-vs-Chainlink threshold.
    expect(await pool.getCurrentFeeBps()).to.equal(50n);

    // ---------------------------------------------------------
    // Swap 1: WETH -> USDX with 0.50% fee
    // ---------------------------------------------------------

    const wethIn = ethers.parseEther("0.1");

    await weth.connect(bob).deposit({
      value: wethIn,
    });

    await weth.connect(bob).approve(poolAddress, wethIn);

    // 0.50% total fee: retain 99.50% for pricing
    const effectiveWethIn = (wethIn * 9950n) / 10000n;

    const expectedUsdxOut = (initialUsdx * effectiveWethIn) / (initialWeth + effectiveWethIn);

    // Quoted amount should use the high fee
    expect(await pool.getAmountOut(wethIn, initialWeth, initialUsdx)).to.equal(expectedUsdxOut);

    await pool.connect(bob).swapExactWethForUsdx(wethIn, expectedUsdxOut, ethers.MaxUint256);

    expect(await usdx.balanceOf(bob.address)).to.equal(expectedUsdxOut);

    // Full 0.05% to treasury, remaining 0.45% retained for LPs.
    expect(await pool.protocolFeesWeth()).to.equal(ethers.parseEther("0.00005"));

    // ---------------------------------------------------------
    // Swap 2: USDX -> WETH with 0.50% fee
    // ---------------------------------------------------------

    const reserves = await pool.getReserves();

    // Deviation is still above the threshold
    expect(await pool.getCurrentFeeBps()).to.equal(50n);

    const usdxIn = ethers.parseUnits("100", 18);

    await usdx.connect(bob).approve(poolAddress, usdxIn);

    const effectiveUsdxIn = (usdxIn * 9950n) / 10000n;

    const expectedWethOut = (reserves[0] * effectiveUsdxIn) / (reserves[1] + effectiveUsdxIn);

    await pool.connect(bob).swapExactUsdxForWeth(usdxIn, expectedWethOut, ethers.MaxUint256);

    expect(await weth.balanceOf(bob.address)).to.equal(expectedWethOut);

    expect(await pool.protocolFeesUsdx()).to.equal(ethers.parseUnits("0.05", 18));
  });

  // =========================================================
  // TWAP: 30-minute time-weighted average of the pool price
  // =========================================================

  async function deployTwapPool() {
    const [alice, bob] = await ethers.getSigners();
    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");
    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);

    const initialWeth = ethers.parseEther("1");
    const initialUsdx = ethers.parseEther("2500");

    await weth.connect(alice).deposit({ value: initialWeth });
    await weth.connect(alice).approve(await pool.getAddress(), initialWeth);
    await usdx.connect(alice).approve(await pool.getAddress(), initialUsdx);
    await pool.connect(alice).addLiquidity(initialWeth, initialUsdx, 1n, ethers.MaxUint256);

    return { alice, bob, usdx, weth, pool, initialWeth, initialUsdx };
  }

  it("Should wait 30 minutes before providing the first TWAP", async function () {
    const { pool } = await deployTwapPool();

    expect(await pool.TWAP_WINDOW()).to.equal(1800n);
    expect(await pool.getSpotPrice18()).to.equal(ethers.parseEther("2500"));

    await expect(pool.getTwapPrice18()).to.be.revertedWith("TWAP warming up");

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    expect(await pool.getTwapPrice18()).to.equal(ethers.parseEther("2500"));
  });

  it("Should calculate a time-weighted rather than a spot price", async function () {
    const { bob, weth, pool } = await deployTwapPool();
    const initialPrice = ethers.parseEther("2500");

    const wethIn = ethers.parseEther("0.1");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(await pool.getAddress(), wethIn);

    // Keep the original price for about 20 minutes.
    await ethers.provider.send("evm_increaseTime", [1200]);
    await ethers.provider.send("evm_mine", []);

    // This swap changes the reserve price. Its mined timestamp is the exact
    // boundary between the two prices in the TWAP calculation.
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);
    const swapBlock = await ethers.provider.getBlock("latest");
    if (!swapBlock) throw new Error("Missing swap block");

    const spotAfterSwap = await pool.getSpotPrice18();
    expect(spotAfterSwap < initialPrice).to.equal(true);

    // Let the new reserve price persist for another ~10 minutes.
    await ethers.provider.send("evm_increaseTime", [600]);
    await ethers.provider.send("evm_mine", []);
    const endBlock = await ethers.provider.getBlock("latest");
    if (!endBlock) throw new Error("Missing end block");

    const windowStart = BigInt(endBlock.timestamp) - 1800n;
    const oldPriceSeconds = BigInt(swapBlock.timestamp) - windowStart;
    const newPriceSeconds = 1800n - oldPriceSeconds;
    const expectedTwap = (initialPrice * oldPriceSeconds + spotAfterSwap * newPriceSeconds) / 1800n;

    expect(await pool.getTwapPrice18()).to.equal(expectedTwap);
    expect(await pool.getTwapPrice18()).to.be.greaterThan(spotAfterSwap);

    // The window slides: after a full 30 minutes at the new price,
    // the historical old price no longer affects the TWAP.
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.getTwapPrice18()).to.equal(spotAfterSwap);
  });

  it("Should compare its TWAP against the Chainlink-compatible feed", async function () {
    const { pool } = await deployTwapPool();

    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [
      await mockFeed.getAddress(),
      5400n, // Allow more than one hour for the Sepolia feed.
    ]);

    await pool.setPriceOracle(await oracle.getAddress());
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    expect(await pool.getTwapDeviationBps()).to.equal(0n);

    // $2500 pool TWAP versus $2000 Chainlink is a 25% (2500 bps) deviation.
    await mockFeed.setAnswer(200000000000n);
    expect(await pool.getTwapDeviationBps()).to.equal(2500n);
  });

  it("Should reset the TWAP warm-up when all liquidity is removed", async function () {
    const { alice, pool } = await deployTwapPool();

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.getTwapPrice18()).to.equal(ethers.parseEther("2500"));

    const shares = await pool.balanceOf(alice.address);
    await pool.removeLiquidity(shares, 1n, 1n, ethers.MaxUint256);
    await expect(pool.getTwapPrice18()).to.be.revertedWith("No liquidity");

    // Re-entering with the same tokens starts a new, independent price epoch.
    const weth = await ethers.getContractAt("WETH", await pool.weth());
    const usdx = await ethers.getContractAt("USDX", await pool.usdx());
    await weth.approve(await pool.getAddress(), ethers.parseEther("1"));
    await usdx.approve(await pool.getAddress(), ethers.parseEther("2500"));
    await pool.addLiquidity(ethers.parseEther("1"), ethers.parseEther("2500"), 1n, ethers.MaxUint256);

    await expect(pool.getTwapPrice18()).to.be.revertedWith("TWAP warming up");
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.getTwapPrice18()).to.equal(ethers.parseEther("2500"));
  });

  // =========================================================
  // Dynamic Fee + TWAP Integration
  // =========================================================

  it("Should use a fixed 0.30% during TWAP warm-up without validating Chainlink", async function () {
    const { pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    expect(await pool.isTwapReady()).to.equal(false);
    expect(await pool.getEffectivePriceDeviationBps()).to.equal(0n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    // Neither the Chainlink nor spot deviation activates high fees in warm-up.
    await mockFeed.setAnswer(200000000000n);
    expect(await pool.getPriceDeviationBps()).to.equal(2500n);
    expect(await pool.getEffectivePriceDeviationBps()).to.equal(0n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    await mockFeed.setAnswer(-1n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.isTwapReady()).to.equal(true);
    await expect(pool.getCurrentFeeBps()).to.be.revertedWith("Invalid oracle price");
  });

  it("Should keep the high fee when TWAP is far from Chainlink but spot has recovered", async function () {
    const { bob, usdx, weth, pool } = await deployTwapPool();
    const poolAddress = await pool.getAddress();

    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);
    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    // First trade moves spot sharply away from $2500.
    const wethIn = ethers.parseEther("0.1");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(poolAddress, wethIn);
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);
    expect(await pool.getPriceDeviationBps()).to.be.greaterThan(100n);

    // Keep the displaced price for a full window.
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.isTwapReady()).to.equal(true);

    // Trader swaps the received USDX back; current spot is near $2500 again.
    const usdxIn = await usdx.balanceOf(bob.address);
    await usdx.connect(bob).approve(poolAddress, usdxIn);
    await pool.connect(bob).swapExactUsdxForWeth(usdxIn, 1n, ethers.MaxUint256);

    const spotDeviation = await pool.getPriceDeviationBps();
    const twapDeviation = await pool.getTwapDeviationBps();

    expect(spotDeviation).to.be.lessThan(100n);
    expect(twapDeviation).to.be.greaterThan(100n);
    expect(await pool.getEffectivePriceDeviationBps()).to.be.greaterThan(100n);
    expect(await pool.getCurrentFeeBps()).to.equal(50n);

    // The swap quote must use the 0.50% fee, not the 0.30% base fee.
    const reserves = await pool.getReserves();
    const extraWethIn = ethers.parseEther("0.01");
    const effectiveWethIn = (extraWethIn * 9950n) / 10000n;
    const expectedOut = (reserves[1] * effectiveWethIn) / (reserves[0] + effectiveWethIn);

    expect(await pool.getAmountOut(extraWethIn, reserves[0], reserves[1])).to.equal(expectedOut);
  });

  it("Should continue swapping on spot/TWAP when Chainlink is stale", async function () {
    const { pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect(await pool.isTwapReady()).to.equal(true);

    await mockFeed.setUpdatedAt(1n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    const status = await pool.getDynamicFeeStatus();
    expect(status[2]).to.equal(true);
    expect(status[3]).to.equal(true);
  });

  it("Should activate high fees on spot/TWAP deviation even with a stale oracle", async function () {
    const { bob, weth, pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);
    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    await mockFeed.setUpdatedAt(1n);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    const wethIn = ethers.parseEther("0.1");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(await pool.getAddress(), wethIn);
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);

    const [spotTwap, twapChainlink, fallback, ready, fee] = await pool.getDynamicFeeStatus();
    expect(spotTwap).to.be.greaterThan(100n);
    expect(twapChainlink).to.equal(0n);
    expect(fallback).to.equal(true);
    expect(ready).to.equal(true);
    expect(fee).to.equal(50n);

    // New swaps still execute under the high fee while the feed is stale.
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(await pool.getAddress(), wethIn);
    await pool.connect(bob).swapExactWethForUsdxWithFeeCap(wethIn, 1n, 50n, ethers.MaxUint256);
    expect(await pool.protocolFeesWeth()).to.equal(ethers.parseEther("0.0001"));
  });

  it("Should fall back on a temporarily unavailable feed and automatically recover", async function () {
    const { pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);
    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect((await pool.getDynamicFeeStatus())[2]).to.equal(false);

    await mockFeed.setUnavailable(true);
    expect((await pool.getDynamicFeeStatus())[2]).to.equal(true);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);
    await expect(oracle.getEthUsdPrice18()).to.be.revertedWith("Stale oracle price");

    await mockFeed.setUnavailable(false);
    await mockFeed.setAnswer(200000000000n);
    const status = await pool.getDynamicFeeStatus();
    expect(status[1]).to.be.greaterThan(100n);
    expect(status[2]).to.equal(false);
    expect(status[4]).to.equal(50n);
  });

  it("Should fail closed on malformed oracle prices and timestamps after warm-up", async function () {
    const { pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);
    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    await mockFeed.setAnswer(0n);
    await expect(pool.getCurrentFeeBps()).to.be.revertedWith("Invalid oracle price");
    await mockFeed.setAnswer(-5n);
    await expect(pool.getCurrentFeeBps()).to.be.revertedWith("Invalid oracle price");
    await mockFeed.setAnswer(250000000000n);
    await mockFeed.setUpdatedAt(0n);
    await expect(pool.getCurrentFeeBps()).to.be.revertedWith("Invalid oracle timestamp");

    const latest = await ethers.provider.getBlock("latest");
    if (!latest) throw new Error("Missing block");
    await mockFeed.setUpdatedAt(BigInt(latest.timestamp + 3600));
    await expect(pool.getCurrentFeeBps()).to.be.revertedWith("Invalid oracle timestamp");
  });

  // =========================================================
  // Protocol Treasury & Emergency Swap Pause
  // =========================================================

  it("Should let only the owner pause and resume swaps, while LP exits stay available", async function () {
    const { alice, bob, usdx, weth, pool } = await deployTwapPool();
    const poolAddress = await pool.getAddress();

    expect(await pool.paused()).to.equal(false);
    await expect(pool.connect(bob).pauseSwaps()).to.revert(ethers);

    await pool.connect(alice).pauseSwaps();
    expect(await pool.paused()).to.equal(true);
    await expect(pool.connect(bob).resumeSwaps()).to.revert(ethers);

    const wethIn = ethers.parseEther("0.1");
    const usdxIn = ethers.parseEther("100");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(poolAddress, wethIn);
    await usdx.transfer(bob.address, usdxIn);
    await usdx.connect(bob).approve(poolAddress, usdxIn);

    await expect(pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256)).to.be.revertedWithCustomError(
      pool,
      "EnforcedPause",
    );
    await expect(pool.connect(bob).swapExactUsdxForWeth(usdxIn, 1n, ethers.MaxUint256)).to.be.revertedWithCustomError(
      pool,
      "EnforcedPause",
    );

    // Pausing trading must not trap the LP's underlying WETH and USDX.
    const aliceShares = await pool.balanceOf(alice.address);
    await pool.connect(alice).removeLiquidity(aliceShares / 2n, 1n, 1n, ethers.MaxUint256);
    expect(await pool.paused()).to.equal(true);
    expect(await pool.balanceOf(alice.address)).to.equal(aliceShares / 2n);

    await pool.connect(alice).resumeSwaps();
    expect(await pool.paused()).to.equal(false);

    // Trading resumes with the reduced reserves after the LP exit.
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);
    expect(await usdx.balanceOf(bob.address)).to.be.greaterThan(usdxIn);
  });

  it("Should withdraw only accrued protocol fees and preserve every LP reserve", async function () {
    const { alice, bob, usdx, weth, pool } = await deployTwapPool();
    const [, , recipient] = await ethers.getSigners();
    const poolAddress = await pool.getAddress();

    // Generate fees in both token denominations.
    const wethIn = ethers.parseEther("0.1");
    const usdxIn = ethers.parseEther("100");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(poolAddress, wethIn);
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);

    await usdx.connect(bob).approve(poolAddress, usdxIn);
    await pool.connect(bob).swapExactUsdxForWeth(usdxIn, 1n, ethers.MaxUint256);

    const accruedWeth = ethers.parseEther("0.00005");
    const accruedUsdx = ethers.parseEther("0.05");
    expect(await pool.protocolFeesWeth()).to.equal(accruedWeth);
    expect(await pool.protocolFeesUsdx()).to.equal(accruedUsdx);

    const reservesBefore = await pool.getReserves();

    await expect(pool.connect(bob).withdrawProtocolFees(recipient.address, 1n, 0n)).to.revert(ethers);
    await expect(pool.connect(alice).withdrawProtocolFees(recipient.address, accruedWeth + 1n, 0n)).to.be.revertedWith(
      "Exceeds WETH protocol fees",
    );
    await expect(pool.connect(alice).withdrawProtocolFees(recipient.address, 0n, accruedUsdx + 1n)).to.be.revertedWith(
      "Exceeds USDX protocol fees",
    );

    // Partial withdrawal, sent to the chosen treasury recipient.
    const withdrawWeth = ethers.parseEther("0.00002");
    const withdrawUsdx = ethers.parseEther("0.02");
    await pool.connect(alice).withdrawProtocolFees(recipient.address, withdrawWeth, withdrawUsdx);

    expect(await weth.balanceOf(recipient.address)).to.equal(withdrawWeth);
    expect(await usdx.balanceOf(recipient.address)).to.equal(withdrawUsdx);
    expect(await pool.protocolFeesWeth()).to.equal(accruedWeth - withdrawWeth);
    expect(await pool.protocolFeesUsdx()).to.equal(accruedUsdx - withdrawUsdx);

    // All LP reserves are unchanged, even after both protocol fees are paid.
    expect(await pool.getReserves()).to.deep.equal(reservesBefore);
    expect(await weth.balanceOf(poolAddress)).to.equal(reservesBefore[0] + accruedWeth - withdrawWeth);
    expect(await usdx.balanceOf(poolAddress)).to.equal(reservesBefore[1] + accruedUsdx - withdrawUsdx);

    await pool
      .connect(alice)
      .withdrawProtocolFees(recipient.address, accruedWeth - withdrawWeth, accruedUsdx - withdrawUsdx);

    expect(await pool.protocolFeesWeth()).to.equal(0n);
    expect(await pool.protocolFeesUsdx()).to.equal(0n);
    expect(await weth.balanceOf(poolAddress)).to.equal(reservesBefore[0]);
    expect(await usdx.balanceOf(poolAddress)).to.equal(reservesBefore[1]);
  });

  it("Should reject invalid protocol withdrawals and allow treasury withdrawals while swaps are paused", async function () {
    const { alice, bob, weth, pool } = await deployTwapPool();
    const poolAddress = await pool.getAddress();

    await expect(pool.withdrawProtocolFees(ethers.ZeroAddress, 1n, 0n)).to.be.revertedWith("Invalid recipient");
    await expect(pool.withdrawProtocolFees(poolAddress, 1n, 0n)).to.be.revertedWith("Invalid recipient");
    await expect(pool.withdrawProtocolFees(alice.address, 0n, 0n)).to.be.revertedWith("Nothing to withdraw");
    await expect(pool.withdrawProtocolFees(alice.address, 1n, 0n)).to.be.revertedWith("Exceeds WETH protocol fees");

    const wethIn = ethers.parseEther("0.1");
    await weth.connect(bob).deposit({ value: wethIn });
    await weth.connect(bob).approve(poolAddress, wethIn);
    await pool.connect(bob).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);

    const accruedWeth = await pool.protocolFeesWeth();
    await pool.connect(alice).pauseSwaps();
    await pool.connect(alice).withdrawProtocolFees(alice.address, accruedWeth, 0n);

    expect(await pool.paused()).to.equal(true);
    expect(await pool.protocolFeesWeth()).to.equal(0n);
  });

  // =========================================================
  // LP ownership (no Membership tiers or separate bonus accounting)
  // =========================================================

  async function deployMultiLpPool() {
    const [alice, bob, trader] = await ethers.getSigners();
    const usdx = await ethers.deployContract("USDX");
    const weth = await ethers.deployContract("WETH");
    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdx.getAddress()]);
    const poolAddress = await pool.getAddress();

    await weth.connect(alice).deposit({ value: ethers.parseEther("1") });
    await weth.connect(alice).approve(poolAddress, ethers.parseEther("1"));
    await usdx.connect(alice).approve(poolAddress, ethers.parseEther("2500"));
    await pool.connect(alice).addLiquidity(ethers.parseEther("1"), ethers.parseEther("2500"), 1n, ethers.MaxUint256);

    await usdx.connect(alice).transfer(bob.address, ethers.parseEther("1250"));
    await weth.connect(bob).deposit({ value: ethers.parseEther("0.5") });
    await weth.connect(bob).approve(poolAddress, ethers.parseEther("0.5"));
    await usdx.connect(bob).approve(poolAddress, ethers.parseEther("1250"));
    await pool.connect(bob).addLiquidity(ethers.parseEther("0.5"), ethers.parseEther("1250"), 1n, ethers.MaxUint256);

    return { alice, bob, trader, usdx, weth, pool, poolAddress };
  }

  it("Should distribute LP-owned reserves proportionally without membership rewards", async function () {
    const { alice, bob, trader, weth, pool, poolAddress } = await deployMultiLpPool();
    expect(await pool.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));
    expect(await pool.balanceOf(bob.address)).to.equal(ethers.parseEther("25"));

    const amountIn = ethers.parseEther("0.1");
    await weth.connect(trader).deposit({ value: amountIn });
    await weth.connect(trader).approve(poolAddress, amountIn);
    await pool.connect(trader).swapExactWethForUsdx(amountIn, 1n, ethers.MaxUint256);

    const fee = (amountIn * 5n) / 10000n;
    expect(await pool.protocolFeesWeth()).to.equal(fee);
    const [wethReserve, usdxReserve] = await pool.getReserves();
    expect(wethReserve).to.equal(ethers.parseEther("1.5") + amountIn - fee);
    expect(await weth.balanceOf(poolAddress)).to.equal(wethReserve + fee);

    // Alice owns 2/3 of all LP shares; Bob owns 1/3.
    await pool.connect(alice).removeLiquidity(ethers.parseEther("50"), 1n, 1n, ethers.MaxUint256);
    expect(await weth.balanceOf(alice.address)).to.equal((wethReserve * 2n) / 3n);
    expect(await pool.balanceOf(bob.address)).to.equal(ethers.parseEther("25"));
    await pool.connect(bob).removeLiquidity(ethers.parseEther("25"), 1n, 1n, ethers.MaxUint256);
    expect(await pool.totalSupply()).to.equal(0n);
    expect(await pool.getReserves()).to.deep.equal([0n, 0n]);
    expect(await weth.balanceOf(poolAddress)).to.equal(fee);
    expect(usdxReserve).to.be.greaterThan(0n);
  });

  // =========================================================
  // Security: fee caps and one-way configuration finalization
  // =========================================================

  it("Should reject a WETH swap if the dynamic fee exceeds the user's cap", async function () {
    const { bob, weth, pool } = await deployTwapPool();
    const poolAddress = await pool.getAddress();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);
    expect(await pool.getCurrentFeeBps()).to.equal(30n);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    const amountIn = ethers.parseEther("0.1");
    await weth.connect(bob).deposit({ value: amountIn });
    await weth.connect(bob).approve(poolAddress, amountIn);
    const reservesBefore = await pool.getReserves();

    // The price moves between the user's quote and the transaction being mined.
    await mockFeed.setAnswer(200000000000n);
    expect(await pool.getCurrentFeeBps()).to.equal(50n);

    await expect(
      pool.connect(bob).swapExactWethForUsdxWithFeeCap(amountIn, 1n, 30n, ethers.MaxUint256),
    ).to.be.revertedWith("Trading fee exceeds limit");

    expect(await pool.getReserves()).to.deep.equal(reservesBefore);
    expect(await weth.balanceOf(bob.address)).to.equal(amountIn);

    await expect(
      pool.connect(bob).swapExactWethForUsdxWithFeeCap(amountIn, 1n, 51n, ethers.MaxUint256),
    ).to.be.revertedWith("Invalid maximum fee");

    await pool.connect(bob).swapExactWethForUsdxWithFeeCap(amountIn, 1n, 50n, ethers.MaxUint256);
    expect(await weth.balanceOf(bob.address)).to.equal(0n);
    expect(await pool.protocolFeesWeth()).to.equal(ethers.parseEther("0.00005"));
  });

  it("Should also protect USDX to WETH swaps with a maximum fee", async function () {
    const { alice, bob, usdx, pool } = await deployTwapPool();
    const poolAddress = await pool.getAddress();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    await pool.setPriceOracle(await oracle.getAddress());
    await pool.setDynamicFeesEnabled(true);

    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);

    const amountIn = ethers.parseEther("100");
    await usdx.connect(alice).transfer(bob.address, amountIn);
    await usdx.connect(bob).approve(poolAddress, amountIn);

    await mockFeed.setAnswer(200000000000n);
    await expect(
      pool.connect(bob).swapExactUsdxForWethWithFeeCap(amountIn, 1n, 30n, ethers.MaxUint256),
    ).to.be.revertedWith("Trading fee exceeds limit");

    await pool.connect(bob).swapExactUsdxForWethWithFeeCap(amountIn, 1n, 50n, ethers.MaxUint256);
    expect(await pool.protocolFeesUsdx()).to.equal(ethers.parseEther("0.05"));
  });

  it("Should permanently lock oracle settings without disabling emergency exits", async function () {
    const { alice, bob, pool } = await deployTwapPool();
    const mockFeed = await ethers.deployContract("MockPriceFeed", [8, 250000000000n]);
    const oracle = await ethers.deployContract("PriceOracle", [await mockFeed.getAddress(), 5400n]);

    await expect(pool.finalizeSettings()).to.be.revertedWith("Oracle not configured");
    await pool.setPriceOracle(await oracle.getAddress());
    await expect(pool.finalizeSettings()).to.be.revertedWith("Dynamic fees not enabled");
    await expect(pool.connect(bob).finalizeSettings()).to.revert(ethers);

    await pool.setDynamicFeesEnabled(true);
    await mockFeed.setUpdatedAt(1n);
    await expect(pool.finalizeSettings()).to.be.revertedWith("Stale oracle price");
    await mockFeed.setAnswer(250000000000n);
    await pool.connect(alice).finalizeSettings();
    expect(await pool.settingsFinalized()).to.equal(true);

    await expect(pool.finalizeSettings()).to.be.revertedWith("Settings finalized");
    await expect(pool.setPriceOracle(await oracle.getAddress())).to.be.revertedWith("Settings finalized");
    await expect(pool.setDynamicFeesEnabled(false)).to.be.revertedWith("Settings finalized");

    // A stale feed cannot be replaced after finalization, but trading falls
    // back to spot/TWAP. Emergency pause and LP exits remain available.
    await mockFeed.setUpdatedAt(1n);
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    expect((await pool.getDynamicFeeStatus())[2]).to.equal(true);
    await pool.pauseSwaps();

    const shares = await pool.balanceOf(alice.address);
    await pool.removeLiquidity(shares, 1n, 1n, ethers.MaxUint256);
    expect(await pool.balanceOf(alice.address)).to.equal(0n);
  });

  // =========================================================
  // Additional security: token validation and exact asset accounting
  // =========================================================

  it("Should reject non-contract addresses as pool tokens", async function () {
    const [alice] = await ethers.getSigners();
    const usdx = await ethers.deployContract("USDX");

    await expect(ethers.deployContract("AMMPool", [alice.address, await usdx.getAddress()])).to.be.revertedWith(
      "Token must be a contract",
    );
  });

  it("Should reject taxed liquidity deposits without changing reserves or balances", async function () {
    const [alice] = await ethers.getSigners();
    const weth = await ethers.deployContract("WETH");
    const taxedToken = await ethers.deployContract("MockFeeOnTransferToken");
    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await taxedToken.getAddress()]);
    const poolAddress = await pool.getAddress();
    const wethAmount = ethers.parseEther("1");
    const taxedAmount = ethers.parseEther("2500");

    await weth.deposit({ value: wethAmount });
    await weth.approve(poolAddress, wethAmount);
    await taxedToken.approve(poolAddress, taxedAmount);

    await expect(pool.addLiquidity(wethAmount, taxedAmount, 1n, ethers.MaxUint256)).to.be.revertedWith(
      "Unsupported token transfer",
    );

    expect(await pool.getReserves()).to.deep.equal([0n, 0n]);
    expect(await pool.totalSupply()).to.equal(0n);
    expect(await weth.balanceOf(poolAddress)).to.equal(0n);
    expect(await taxedToken.balanceOf(poolAddress)).to.equal(0n);
    expect(await weth.balanceOf(alice.address)).to.equal(wethAmount);
    expect(await taxedToken.balanceOf(alice.address)).to.equal(ethers.parseEther("1000000"));
  });

  it("Should conserve pool balances across swaps, treasury payouts and LP exits", async function () {
    const { alice, trader, weth, usdx, pool, poolAddress } = await deployMultiLpPool();

    const assertExactAccounting = async () => {
      const [reserveWeth, reserveUsdx] = await pool.getReserves();
      expect(await weth.balanceOf(poolAddress)).to.equal(reserveWeth + (await pool.protocolFeesWeth()));
      expect(await usdx.balanceOf(poolAddress)).to.equal(reserveUsdx + (await pool.protocolFeesUsdx()));
    };

    await assertExactAccounting();

    const wethIn = ethers.parseEther("0.1");
    await weth.connect(trader).deposit({ value: wethIn });
    await weth.connect(trader).approve(poolAddress, wethIn);
    await pool.connect(trader).swapExactWethForUsdx(wethIn, 1n, ethers.MaxUint256);
    await assertExactAccounting();

    const usdxIn = ethers.parseEther("100");
    await usdx.connect(alice).transfer(trader.address, usdxIn);
    await usdx.connect(trader).approve(poolAddress, usdxIn);
    await pool.connect(trader).swapExactUsdxForWeth(usdxIn, 1n, ethers.MaxUint256);
    await assertExactAccounting();

    await pool
      .connect(alice)
      .withdrawProtocolFees(alice.address, await pool.protocolFeesWeth(), await pool.protocolFeesUsdx());
    await assertExactAccounting();

    await pool.connect(alice).removeLiquidity(ethers.parseEther("10"), 1n, 1n, ethers.MaxUint256);
    await assertExactAccounting();
  });
});
