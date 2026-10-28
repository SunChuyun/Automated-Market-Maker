// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract AMMPool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable weth;
    IERC20 public immutable usdx;

    uint256 public reserveWeth;
    uint256 public reserveUsdx;

    // Fee denominator: 10,000 basis points = 100%
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Placeholder fee parameters
    uint256 public constant BASE_FEE_BPS = 30;      // 0.30%
    uint256 public constant PROTOCOL_FEE_BPS = 5;  // 0.05%

    // Protocol fees are excluded from LP reserves
    uint256 public protocolFeesWeth;
    uint256 public protocolFeesUsdx;

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

    constructor(
        address _weth,
        address _usdx
    ) ERC20("WETH-USDX LP Token", "WUSDX-LP") {
        require(_weth != address(0), "Invalid WETH");
        require(_usdx != address(0), "Invalid USDX");
        require(_weth != _usdx, "Tokens must differ");

        weth = IERC20(_weth);
        usdx = IERC20(_usdx);
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
            } else {
                wethIn = Math.mulDiv(
                    usdxDesired,
                    reserveWeth,
                    reserveUsdx
                );
            }

            shares = Math.min(
                Math.mulDiv(wethIn, supply, reserveWeth),
                Math.mulDiv(usdxIn, supply, reserveUsdx)
            );
        }

        require(wethIn > 0 && usdxIn > 0, "Amount too small");
        require(shares > 0, "Zero LP shares");
        require(shares >= minShares, "Insufficient LP shares");

        weth.safeTransferFrom(msg.sender, address(this), wethIn);
        usdx.safeTransferFrom(msg.sender, address(this), usdxIn);

        reserveWeth += wethIn;
        reserveUsdx += usdxIn;

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

        reserveWeth -= wethOut;
        reserveUsdx -= usdxOut;

        weth.safeTransfer(msg.sender, wethOut);
        usdx.safeTransfer(msg.sender, usdxOut);

        emit LiquidityRemoved(
            msg.sender,
            wethOut,
            usdxOut,
            shares
        );
    }

    // Calculate output amount after the base trading fee
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Zero swap amount");
        require(
            reserveIn > 0 && reserveOut > 0,
            "Insufficient liquidity"
        );

        uint256 effectiveInput = Math.mulDiv(
            amountIn,
            FEE_DENOMINATOR - BASE_FEE_BPS,
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
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");

        amountOut = getAmountOut(
            amountIn,
            reserveWeth,
            reserveUsdx
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
        reserveWeth += amountIn - protocolFee;
        reserveUsdx -= amountOut;

        // Account for protocol fees separately
        protocolFeesWeth += protocolFee;

        // Send USDX to trader
        usdx.safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(
            msg.sender,
            address(weth),
            address(usdx),
            amountIn,
            amountOut,
            BASE_FEE_BPS,
            protocolFee
        );
    }

    // Swap exact USDX for WETH
    function swapExactUsdxForWeth(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");

        amountOut = getAmountOut(
            amountIn,
            reserveUsdx,
            reserveWeth
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
        reserveUsdx += amountIn - protocolFee;
        reserveWeth -= amountOut;

        // Account for protocol fees separately
        protocolFeesUsdx += protocolFee;

        // Send WETH to trader
        weth.safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(
            msg.sender,
            address(usdx),
            address(weth),
            amountIn,
            amountOut,
            BASE_FEE_BPS,
            protocolFee
        );
    }
}