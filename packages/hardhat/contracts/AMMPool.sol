// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// Interface for our PriceOracle contract
interface IPriceOracle {
    function getEthUsdPrice18() external view returns (uint256);
    function getEthUsdPriceWithStatus18() external view returns (uint256, bool);
}

contract AMMPool is ERC20, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable weth;
    IERC20 public immutable usdx;

    uint256 public reserveWeth;
    uint256 public reserveUsdx;

    // Fee denominator: 10,000 basis points = 100%
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Total fee: 30 or 50 bps. Treasury always receives 5 bps of the input;
    // the remaining 25 or 45 bps accrue automatically to LP-owned reserves.
    uint256 public constant BASE_FEE_BPS = 30;
    uint256 public constant PROTOCOL_FEE_BPS = 5;
    uint256 public constant HIGH_FEE_BPS = 50;
    uint256 public constant SPOT_TWAP_THRESHOLD_BPS = 100;
    uint256 public constant TWAP_CHAINLINK_THRESHOLD_BPS = 100;

    // TWAP uses a fixed 30-minute trailing window. Prices have 18 decimals.
    uint256 public constant TWAP_WINDOW = 30 minutes;

    struct PriceObservation {
        uint64 timestamp;
        // Fits in the same 256-bit storage slot as timestamp (64 + 192).
        uint192 spotPrice;
        uint256 cumulativePrice;
    }

    // Each observation records the cumulative price and the spot price that
    // applies after a reserve change. Swaps store an observation; proportional
    // LP operations may skip a redundant observation when the spot is unchanged.
    // The trailing-window average remains exact in either case.
    PriceObservation[] public priceObservations;
    uint256 public twapEpochStartIndex;
    uint256 public priceCumulativeLast;
    uint256 public lastPriceTimestamp;

    // Protocol fees are excluded from LP reserves
    uint256 public protocolFeesWeth;
    uint256 public protocolFeesUsdx;

    IPriceOracle public priceOracle;

    bool public dynamicFeesEnabled;
    bool public settingsFinalized;

    event LiquidityAdded(
        address indexed provider,
        uint256 wethAmount,
        uint256 usdxAmount,
        uint256 sharesMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 wethAmount,
        uint256 usdxAmount,
        uint256 sharesBurned
    );

    event SwapExecuted(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 totalFeeBps,
        uint256 protocolFeeAmount
    );

    event ProtocolFeesWithdrawn(
        address indexed recipient,
        uint256 wethAmount,
        uint256 usdxAmount
    );

    event SettingsFinalized(address indexed oracle);

    constructor(
        address _weth,
        address _usdx
    ) ERC20("WETH-USDX LP Token", "WUSDX-LP") Ownable(msg.sender) {
        require(_weth != address(0), "Invalid WETH");
        require(_usdx != address(0), "Invalid USDX");
        require(_weth != _usdx, "Tokens must differ");
        require(_weth.code.length > 0 && _usdx.code.length > 0, "Token must be a contract");

        weth = IERC20(_weth);
        usdx = IERC20(_usdx);
    }

    // Emergency stop: blocks swaps only. LPs may still add/remove liquidity,
    // transfer LP tokens, and withdraw their assets while trading is paused.
    function pauseSwaps() external onlyOwner {
        _pause();
    }

    function resumeSwaps() external onlyOwner {
        _unpause();
    }

    // Treasury can withdraw ONLY the separately recorded protocol fees.
    // LP reserves are never reduced by this function.
    function withdrawProtocolFees(
        address recipient,
        uint256 wethAmount,
        uint256 usdxAmount
    ) external onlyOwner nonReentrant {
        require(recipient != address(0) && recipient != address(this), "Invalid recipient");
        require(wethAmount > 0 || usdxAmount > 0, "Nothing to withdraw");
        require(wethAmount <= protocolFeesWeth, "Exceeds WETH protocol fees");
        require(usdxAmount <= protocolFeesUsdx, "Exceeds USDX protocol fees");

        // Checks-effects-interactions: update accounting before ERC-20 calls.
        protocolFeesWeth -= wethAmount;
        protocolFeesUsdx -= usdxAmount;

        if (wethAmount > 0) {
            weth.safeTransfer(recipient, wethAmount);
        }

        if (usdxAmount > 0) {
            usdx.safeTransfer(recipient, usdxAmount);
        }

        emit ProtocolFeesWithdrawn(recipient, wethAmount, usdxAmount);
    }

    // OpenZeppelin v5's _update covers mint, burn, transfer and transferFrom.
    // Prevent accidentally sending LP tokens to the pool itself, where they
    // could otherwise become inaccessible for redemption.
    function _update(address from, address to, uint256 value) internal override {
        require(to != address(this), "Cannot transfer LP to pool");
        super._update(from, to, value);
    }

    // Read the current pool reserves
    function getReserves()
        external
        view
        returns (uint256, uint256)
    {
        return (reserveWeth, reserveUsdx);
    }

    // Add Liquidity
    function addLiquidity(
        uint256 wethDesired,
        uint256 usdxDesired,
        uint256 minShares,
        uint256 deadline
    ) external nonReentrant returns (uint256 shares) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(wethDesired > 0 && usdxDesired > 0, "Zero amount");

        uint256 wethIn = wethDesired;
        uint256 usdxIn = usdxDesired;

        uint256 supply = totalSupply();

        if (supply == 0) {
            // First LP
            shares = Math.sqrt(wethIn * usdxIn);
        } else {
            // Maintain the existing reserve ratio
            uint256 optimalUsdx = Math.mulDiv(
                wethDesired,
                reserveUsdx,
                reserveWeth
            );

            if (optimalUsdx <= usdxDesired) {
                usdxIn = optimalUsdx;
                // USDX is the limiting side after rounding down the
                // proportional deposit. Its LP-share quote cannot exceed
                // the WETH quote, so the second mulDiv/min is unnecessary.
                shares = Math.mulDiv(usdxIn, supply, reserveUsdx);
            } else {
                wethIn = Math.mulDiv(
                    usdxDesired,
                    reserveWeth,
                    reserveUsdx
                );
                // Symmetrically, WETH is the limiting side here.
                shares = Math.mulDiv(wethIn, supply, reserveWeth);
            }
        }

        require(wethIn > 0 && usdxIn > 0, "Amount too small");
        require(shares > 0, "Zero LP shares");
        require(shares >= minShares, "Insufficient LP shares");

        // Exact-receipt check: fee-on-transfer tokens would otherwise cause
        // reserves and minted LP shares to exceed actual deposited assets.
        uint256 wethBalanceBefore = weth.balanceOf(address(this));
        uint256 usdxBalanceBefore = usdx.balanceOf(address(this));

        weth.safeTransferFrom(msg.sender, address(this), wethIn);
        usdx.safeTransferFrom(msg.sender, address(this), usdxIn);

        require(
            weth.balanceOf(address(this)) - wethBalanceBefore == wethIn &&
            usdx.balanceOf(address(this)) - usdxBalanceBefore == usdxIn,
            "Unsupported token transfer"
        );

        _accumulatePriceBeforeReserveChange();

        reserveWeth += wethIn;
        reserveUsdx += usdxIn;

        _recordPriceAfterReserveChange(true);

        _mint(msg.sender, shares);

        emit LiquidityAdded(
            msg.sender,
            wethIn,
            usdxIn,
            shares
        );
    }

    // Remove Liquidity
    function removeLiquidity(
        uint256 shares,
        uint256 minWethOut,
        uint256 minUsdxOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 wethOut, uint256 usdxOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(shares > 0, "Zero LP shares");
        require(
            shares <= balanceOf(msg.sender),
            "Insufficient LP shares"
        );

        uint256 supply = totalSupply();

        wethOut = Math.mulDiv(
            shares,
            reserveWeth,
            supply
        );

        usdxOut = Math.mulDiv(
            shares,
            reserveUsdx,
            supply
        );

        require(
            wethOut > 0 && usdxOut > 0,
            "Output too small"
        );
        require(
            wethOut >= minWethOut,
            "Insufficient WETH output"
        );
        require(
            usdxOut >= minUsdxOut,
            "Insufficient USDX output"
        );

        _burn(msg.sender, shares);

        _accumulatePriceBeforeReserveChange();

        reserveWeth -= wethOut;
        reserveUsdx -= usdxOut;

        _recordPriceAfterReserveChange(true);

        weth.safeTransfer(msg.sender, wethOut);
        usdx.safeTransfer(msg.sender, usdxOut);

        emit LiquidityRemoved(
            msg.sender,
            wethOut,
            usdxOut,
            shares
        );
    }

    // Calculate the expected output using the current trading fee
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256 amountOut) {
        uint256 feeBps = getCurrentFeeBps();

        return _getAmountOutAtFee(
            amountIn,
            reserveIn,
            reserveOut,
            feeBps
        );
    }

    // Internal calculation using a specified fee
    function _getAmountOutAtFee(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "Zero swap amount");

        require(
            reserveIn > 0 && reserveOut > 0,
            "Insufficient liquidity"
        );

        require(
            feeBps < FEE_DENOMINATOR,
            "Invalid trading fee"
        );

        uint256 effectiveInput = Math.mulDiv(
            amountIn,
            FEE_DENOMINATOR - feeBps,
            FEE_DENOMINATOR
        );

        require(effectiveInput > 0, "Swap amount too small");

        amountOut = Math.mulDiv(
            reserveOut,
            effectiveInput,
            reserveIn + effectiveInput
        );

        require(amountOut > 0, "Output too small");
    }

    // Swap exact WETH for USDX
    function swapExactWethForUsdx(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        return _swapExactWethForUsdx(amountIn, minAmountOut, HIGH_FEE_BPS, deadline);
    }

    // Preferred frontend entry point: a transaction will revert if the
    // dynamic fee increased beyond the user's approved maximum.
    function swapExactWethForUsdxWithFeeCap(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxFeeBps,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        return _swapExactWethForUsdx(amountIn, minAmountOut, maxFeeBps, deadline);
    }

    function _swapExactWethForUsdx(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxFeeBps,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(maxFeeBps <= HIGH_FEE_BPS, "Invalid maximum fee");

        // Determine fee before executing the swap
        uint256 appliedFeeBps = getCurrentFeeBps();
        require(appliedFeeBps <= maxFeeBps, "Trading fee exceeds limit");

        amountOut = _getAmountOutAtFee(
            amountIn,
            reserveWeth,
            reserveUsdx,
            appliedFeeBps
        );

        require(amountOut >= minAmountOut, "Insufficient output");

        uint256 protocolFee = Math.mulDiv(
            amountIn,
            PROTOCOL_FEE_BPS,
            FEE_DENOMINATOR
        );

        // Receive WETH
        uint256 balanceBefore = weth.balanceOf(address(this));

        weth.safeTransferFrom(
            msg.sender,
            address(this),
            amountIn
        );

        require(
            weth.balanceOf(address(this)) - balanceBefore == amountIn,
            "Unsupported token transfer"
        );

        // Update reserves
        _accumulatePriceBeforeReserveChange();

        reserveWeth += amountIn - protocolFee;
        reserveUsdx -= amountOut;

        _recordPriceAfterReserveChange(false);

        // Treasury receives the full 0.05%; LP fees stay in reserves.
        protocolFeesWeth += protocolFee;

        // Send USDX to trader
        usdx.safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(
            msg.sender,
            address(weth),
            address(usdx),
            amountIn,
            amountOut,
            appliedFeeBps,
            protocolFee
        );
    }

    // Swap exact USDX for WETH
    function swapExactUsdxForWeth(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        return _swapExactUsdxForWeth(amountIn, minAmountOut, HIGH_FEE_BPS, deadline);
    }

    function swapExactUsdxForWethWithFeeCap(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxFeeBps,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        return _swapExactUsdxForWeth(amountIn, minAmountOut, maxFeeBps, deadline);
    }

    function _swapExactUsdxForWeth(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxFeeBps,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(maxFeeBps <= HIGH_FEE_BPS, "Invalid maximum fee");

        // Determine fee before executing the swap
        uint256 appliedFeeBps = getCurrentFeeBps();
        require(appliedFeeBps <= maxFeeBps, "Trading fee exceeds limit");

        amountOut = _getAmountOutAtFee(
            amountIn,
            reserveUsdx,
            reserveWeth,
            appliedFeeBps
        );

        require(amountOut >= minAmountOut, "Insufficient output");

        uint256 protocolFee = Math.mulDiv(
            amountIn,
            PROTOCOL_FEE_BPS,
            FEE_DENOMINATOR
        );

        // Receive USDX
        uint256 balanceBefore = usdx.balanceOf(address(this));

        usdx.safeTransferFrom(
            msg.sender,
            address(this),
            amountIn
        );

        require(
            usdx.balanceOf(address(this)) - balanceBefore == amountIn,
            "Unsupported token transfer"
        );

        // Update reserves
        _accumulatePriceBeforeReserveChange();

        reserveUsdx += amountIn - protocolFee;
        reserveWeth -= amountOut;

        _recordPriceAfterReserveChange(false);

        protocolFeesUsdx += protocolFee;

        // Send WETH to trader
        weth.safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(
            msg.sender,
            address(usdx),
            address(weth),
            amountIn,
            amountOut,
            appliedFeeBps,
            protocolFee
        );
    }

    // Select trading fee based on price deviation
    function calculateFeeBps(
        uint256 priceDeviationBps
    ) public pure returns (uint256) {
        if (priceDeviationBps >= SPOT_TWAP_THRESHOLD_BPS) {
            return HIGH_FEE_BPS;
        }

        return BASE_FEE_BPS;
    }

    // Set the price oracle (owner only)
    function setPriceOracle(address _oracle) external onlyOwner {
        require(!settingsFinalized, "Settings finalized");
        require(_oracle != address(0), "Invalid oracle");
        require(_oracle.code.length > 0, "Oracle must be a contract");

        priceOracle = IPriceOracle(_oracle);
    }

    // Enable or disable dynamic fees (owner only)
    function setDynamicFeesEnabled(bool enabled) external onlyOwner {
        require(!settingsFinalized, "Settings finalized");
        if (enabled) {
            require(
                address(priceOracle) != address(0),
                "Oracle not configured"
            );
        }

        dynamicFeesEnabled = enabled;
    }

    // Permanently lock oracle and dynamic-fee activation before the demo.
    // Fee numbers are Solidity constants, already fixed at deployment.
    // If Chainlink subsequently becomes stale or unavailable, dynamic fees
    // fall back to the spot/TWAP signal; malformed oracle values still revert.
    function finalizeSettings() external onlyOwner {
        require(!settingsFinalized, "Settings finalized");
        require(address(priceOracle) != address(0), "Oracle not configured");
        require(dynamicFeesEnabled, "Dynamic fees not enabled");

        // Confirm the configured feed currently returns a valid, fresh price
        // before making the oracle address impossible to change.
        _getReferencePrice18();

        settingsFinalized = true;
        emit SettingsFinalized(address(priceOracle));
    }

    // Calculate the deviation between the current pool SPOT price and
    // Chainlink. Retained for the UI and backwards-compatible tests.
    function getPriceDeviationBps() public view returns (uint256) {
        return _deviationBps(getSpotPrice18(), _getReferencePrice18());
    }

    function _getReferencePrice18() internal view returns (uint256) {
        require(address(priceOracle) != address(0), "Oracle not configured");
        uint256 referencePrice = priceOracle.getEthUsdPrice18();
        require(referencePrice > 0, "Invalid oracle price");
        return referencePrice;
    }

    function _deviationBps(
        uint256 poolPrice,
        uint256 referencePrice
    ) internal pure returns (uint256) {
        uint256 difference = poolPrice >= referencePrice
            ? poolPrice - referencePrice
            : referencePrice - poolPrice;
        return Math.mulDiv(difference, FEE_DENOMINATOR, referencePrice);
    }

    // Current USDX/WETH reserve price, treating 1 USDX as 1 USD.
    function getSpotPrice18() public view returns (uint256) {
        require(reserveWeth > 0 && reserveUsdx > 0, "No liquidity");
        return Math.mulDiv(reserveUsdx, 1e18, reserveWeth);
    }

    // Accumulate the OLD pool price for the time elapsed since the last
    // reserve update. Must be called BEFORE changing either reserve.
    function _accumulatePriceBeforeReserveChange() internal {
        if (
            lastPriceTimestamp != 0 &&
            block.timestamp > lastPriceTimestamp &&
            reserveWeth > 0 &&
            reserveUsdx > 0
        ) {
            uint256 elapsed = block.timestamp - lastPriceTimestamp;
            priceCumulativeLast += getSpotPrice18() * elapsed;
        }

        lastPriceTimestamp = block.timestamp;
    }

    // Store the NEW price from this timestamp onward. For LP operations,
    // omit redundant observations if the price did not change. Transactions
    // sharing a timestamp replace the previous observation at that timestamp.
    function _recordPriceAfterReserveChange(bool skipUnchangedPrice) internal {
        if (reserveWeth == 0 || reserveUsdx == 0) {
            // A completely emptied pool starts a fresh TWAP history when
            // liquidity is added again. Prior observations stay inaccessible.
            twapEpochStartIndex = priceObservations.length;
            priceCumulativeLast = 0;
            lastPriceTimestamp = 0;
            return;
        }

        uint256 length = priceObservations.length;
        uint192 spotPrice = SafeCast.toUint192(getSpotPrice18());

        // A proportional LP deposit/withdrawal does not move the spot price.
        // No new observation is required: the last observation's constant
        // spot price already determines cumulative prices up to now. This
        // saves two storage-slot writes for unchanged-price operations.
        if (
            skipUnchangedPrice &&
            length > twapEpochStartIndex &&
            priceObservations[length - 1].spotPrice == spotPrice
        ) {
            return;
        }

        PriceObservation memory observation = PriceObservation({
            timestamp: uint64(block.timestamp),
            cumulativePrice: priceCumulativeLast,
            spotPrice: spotPrice
        });
        if (
            length > twapEpochStartIndex &&
            priceObservations[length - 1].timestamp == block.timestamp
        ) {
            priceObservations[length - 1] = observation;
        } else {
            priceObservations.push(observation);
        }
    }

    // The cumulative price includes the time since the last transaction.
    // This works even if the pool has no transactions for several minutes.
    function _currentCumulativePrice() internal view returns (uint256) {
        uint256 cumulative = priceCumulativeLast;
        if (lastPriceTimestamp != 0 && block.timestamp > lastPriceTimestamp) {
            cumulative += getSpotPrice18() * (block.timestamp - lastPriceTimestamp);
        }
        return cumulative;
    }

    // Exact trailing 30-minute average of the on-chain pool price.
    // Reverts until the pool has existed for a full window.
    function getTwapPrice18() public view returns (uint256) {
        require(reserveWeth > 0 && reserveUsdx > 0, "No liquidity");
        require(priceObservations.length > twapEpochStartIndex, "TWAP uninitialized");

        uint256 firstTimestamp = priceObservations[twapEpochStartIndex].timestamp;
        require(block.timestamp >= firstTimestamp + TWAP_WINDOW, "TWAP warming up");

        uint256 windowStart = block.timestamp - TWAP_WINDOW;

        // Binary-search for the most recent observation no later than the
        // beginning of the TWAP window; O(log(number of observations)).
        uint256 low = twapEpochStartIndex;
        uint256 high = priceObservations.length;
        while (low + 1 < high) {
            uint256 middle = low + (high - low) / 2;
            if (priceObservations[middle].timestamp <= windowStart) {
                low = middle;
            } else {
                high = middle;
            }
        }

        PriceObservation storage beginning = priceObservations[low];
        uint256 cumulativeAtWindowStart = beginning.cumulativePrice +
            beginning.spotPrice * (windowStart - uint256(beginning.timestamp));

        return (_currentCumulativePrice() - cumulativeAtWindowStart) / TWAP_WINDOW;
    }

    // The first 30 minutes after liquidity initialization are a warm-up.
    // During warm-up, trading uses the fixed 30 bps fee without an oracle read.
    function isTwapReady() public view returns (bool) {
        if (
            reserveWeth == 0 ||
            reserveUsdx == 0 ||
            priceObservations.length <= twapEpochStartIndex
        ) {
            return false;
        }

        return block.timestamp >=
            uint256(priceObservations[twapEpochStartIndex].timestamp) + TWAP_WINDOW;
    }

    // Compare the pool's trailing 30-minute average with Chainlink ETH/USD.
    // This is separate from getPriceDeviationBps(), which still uses spot.
    function getTwapDeviationBps() public view returns (uint256) {
        return _deviationBps(getTwapPrice18(), _getReferencePrice18());
    }

    // Exposes the same fee decision displayed by the frontend. The two
    // deviations have independently documented 100-bps trigger thresholds.
    // 'oracleFallback' is true only after TWAP warm-up if the feed is stale
    // or unavailable; malformed prices still cause a revert.
    function getDynamicFeeStatus() public view returns (
        uint256 spotTwapDeviationBps,
        uint256 twapChainlinkDeviationBps,
        bool oracleFallback,
        bool twapReady,
        uint256 currentFeeBps
    ) {
        if (!dynamicFeesEnabled) return (0, 0, false, isTwapReady(), BASE_FEE_BPS);

        twapReady = isTwapReady();
        if (!twapReady) return (0, 0, false, false, BASE_FEE_BPS);

        uint256 twapPrice = getTwapPrice18();
        spotTwapDeviationBps = _deviationBps(getSpotPrice18(), twapPrice);

        require(address(priceOracle) != address(0), "Oracle not configured");
        (uint256 referencePrice, bool fresh) = priceOracle.getEthUsdPriceWithStatus18();
        oracleFallback = !fresh;
        if (fresh) {
            twapChainlinkDeviationBps = _deviationBps(twapPrice, referencePrice);
        }

        currentFeeBps = (
            spotTwapDeviationBps >= SPOT_TWAP_THRESHOLD_BPS ||
            (!oracleFallback && twapChainlinkDeviationBps >= TWAP_CHAINLINK_THRESHOLD_BPS)
        ) ? HIGH_FEE_BPS : BASE_FEE_BPS;
    }

    // Maximum of the two signals, useful for monitoring and existing UI code.
    function getEffectivePriceDeviationBps() public view returns (uint256) {
        (uint256 spotTwap, uint256 twapChainlink,,,) = getDynamicFeeStatus();
        return Math.max(spotTwap, twapChainlink);
    }

    function getCurrentFeeBps() public view returns (uint256) {
        (,,,,uint256 feeBps) = getDynamicFeeStatus();
        return feeBps;
    }
}
