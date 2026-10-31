"""AMM pricing model shared by the financial-analysis notebook.

The swap math mirrors the integer arithmetic the Solidity pool is expected to use,
so a model value can be compared digit-for-digit with a Sepolia transaction.

Assumed contract rules (from the proposal, to be confirmed against AMMPool.sol):
  * total fee is charged on the input amount, in basis points (30 = 0.30%)
  * the protocol share (5 bps) is sent to the treasury and leaves the reserves
  * the LP share stays in the reserves, so it accrues to LP-token holders
  * amountOut = inWithFee * reserveOut / (reserveIn * 10000 + inWithFee)   (Uniswap v2 form)
  * all token amounts are integers with 18 decimals; division rounds down
"""

from dataclasses import dataclass

BPS = 10_000
WAD = 10**18  # 18-decimal fixed point, as in ERC-20 balances

BASE_FEE_BPS = 30  # 0.30% total
HIGH_FEE_BPS = 50  # 0.50% total (dynamic-fee upper tier)
PROTOCOL_FEE_BPS = 5  # 0.05% to the treasury


@dataclass
class SwapResult:
    amount_out: int  # tokens sent to the trader
    protocol_fee: int  # input tokens sent to the treasury
    lp_fee: int  # input tokens kept in the pool for LPs
    new_reserve_in: int
    new_reserve_out: int


def get_amount_out(amount_in: int, reserve_in: int, reserve_out: int, fee_bps: int = BASE_FEE_BPS) -> int:
    """Integer output amount, rounded down exactly as Solidity would."""
    if amount_in <= 0:
        raise ValueError("amount_in must be positive")
    if reserve_in <= 0 or reserve_out <= 0:
        raise ValueError("pool has no liquidity")
    in_with_fee = amount_in * (BPS - fee_bps)
    return in_with_fee * reserve_out // (reserve_in * BPS + in_with_fee)


def swap(
    amount_in: int,
    reserve_in: int,
    reserve_out: int,
    fee_bps: int = BASE_FEE_BPS,
    protocol_fee_bps: int = PROTOCOL_FEE_BPS,
) -> SwapResult:
    """Full swap: output, fee split and the reserves after the trade."""
    amount_out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
    total_fee = amount_in * fee_bps // BPS
    protocol_fee = amount_in * protocol_fee_bps // BPS
    return SwapResult(
        amount_out=amount_out,
        protocol_fee=protocol_fee,
        lp_fee=total_fee - protocol_fee,
        new_reserve_in=reserve_in + amount_in - protocol_fee,
        new_reserve_out=reserve_out - amount_out,
    )


def to_wei(x: float) -> int:
    return int(round(x * WAD))


def from_wei(x: int) -> float:
    return x / WAD


def execution_costs(trade_in: float, reserve_in: float, reserve_out: float, fee_bps: int = BASE_FEE_BPS) -> dict:
    """Split the cost of one trade into fee and curve-driven price impact.

    All values are fractions of the trade's value at the pre-trade spot price.
      curve_impact  cost of the same trade with no fee: a / (x + a)
      total_cost    cost with the fee: 1 - out / (a * spot)
      fee_cost      total_cost - curve_impact
    """
    spot = reserve_out / reserve_in  # output tokens per input token before the trade
    a = trade_in
    out_with_fee = from_wei(get_amount_out(to_wei(a), to_wei(reserve_in), to_wei(reserve_out), fee_bps))
    out_no_fee = from_wei(get_amount_out(to_wei(a), to_wei(reserve_in), to_wei(reserve_out), 0))
    ideal = a * spot
    total = 1 - out_with_fee / ideal
    curve = 1 - out_no_fee / ideal
    return {
        "spot": spot,
        "amount_out": out_with_fee,
        "avg_price": a / out_with_fee,  # input tokens paid per output token
        "curve_impact": curve,
        "fee_cost": total - curve,
        "total_cost": total,
    }


# ---------------------------------------------------------------------------
# Impermanent loss and arbitrage
# ---------------------------------------------------------------------------

import math
from math import isqrt


def impermanent_loss_closed_form(r: float) -> float:
    """Value of a fee-free 50/50 constant-product LP relative to holding, minus one.

    r is the final price divided by the entry price. The formula 2*sqrt(r)/(1+r) - 1 is the
    standard result; Section 2 checks the simulation against it.
    """
    if r <= 0:
        raise ValueError("price ratio must be positive")
    return 2 * math.sqrt(r) / (1 + r) - 1


def arbitrage_trade(reserve_usdx: int, reserve_weth: int, target_price: float, fee_bps: int = 0,
                    extra_cost: float = 0.0):
    """Trade an arbitrageur sends to move the pool spot to the external price.

    Returns (direction, amount_in). direction is "usdx_in" (buy WETH from the pool),
    "weth_in" (sell WETH to the pool) or None when the external price sits inside the
    pool's fee band and no profitable trade exists.

    With fee f (gamma = 1 - f) a trader who has already sent a USDX sees a marginal price of
    (x + gamma*a)^2 / (gamma*x*y) USDX per WETH. Arbitrage stops where that equals the external
    price P, so a = (sqrt(gamma*k*P) - x) / gamma. The sell side is symmetric. With f = 0 this is
    the familiar x' = sqrt(k*P).

    extra_cost is the arbitrageur's cost outside the pool (venue fee, slippage) as a fraction of
    the external leg. It widens the no-trade band: the trade stops where the pool's marginal
    price equals P*(1 - extra_cost) instead of P, while the pool itself still charges fee_bps.
    """
    gamma = (BPS - fee_bps) / BPS
    gamma_t = gamma * (1 - extra_cost)
    x, y = reserve_usdx, reserve_weth
    k = x * y
    spot = x / y
    if target_price > spot / gamma_t:
        new_x = math.sqrt(gamma_t * k * target_price)
        return "usdx_in", int((new_x - x) / gamma)
    if target_price < spot * gamma_t:
        new_y = math.sqrt(gamma_t * k / target_price)
        return "weth_in", int((new_y - y) / gamma)
    return None, 0


# ---------------------------------------------------------------------------
# Stateful pool, LP shares and treasury
# ---------------------------------------------------------------------------


@dataclass
class Pool:
    """A WETH/USDX pool with LP shares and a separate treasury, in 18-decimal integers.

    LP fees stay in the reserves; protocol fees are moved to the treasury fields.
    Share accounting follows the proportional rule: first deposit mints sqrt(x*y) shares,
    later deposits mint shares in proportion to the smaller of the two reserve ratios,
    withdrawals return the pro-rata reserves. To be confirmed against the LP token contract.
    """

    reserve_usdx: int
    reserve_weth: int
    total_shares: int = 0
    treasury_usdx: int = 0
    treasury_weth: int = 0
    lp_fees_usdx: int = 0  # cumulative LP fees retained, for reporting only
    lp_fees_weth: int = 0
    volume_usdx: int = 0  # cumulative traded volume measured in USDX at pre-trade spot

    @classmethod
    def seeded(cls, usdx: float, weth: float) -> "Pool":
        p = cls(to_wei(usdx), to_wei(weth))
        p.total_shares = isqrt(p.reserve_usdx * p.reserve_weth)
        return p

    def spot(self) -> float:
        """USDX per WETH."""
        return self.reserve_usdx / self.reserve_weth

    def swap_usdx_in(self, amount_in: int, fee_bps: int = BASE_FEE_BPS, protocol_fee_bps: int = PROTOCOL_FEE_BPS) -> SwapResult:
        r = swap(amount_in, self.reserve_usdx, self.reserve_weth, fee_bps, protocol_fee_bps)
        self.reserve_usdx, self.reserve_weth = r.new_reserve_in, r.new_reserve_out
        self.treasury_usdx += r.protocol_fee
        self.lp_fees_usdx += r.lp_fee
        self.volume_usdx += amount_in
        return r

    def swap_weth_in(self, amount_in: int, fee_bps: int = BASE_FEE_BPS, protocol_fee_bps: int = PROTOCOL_FEE_BPS) -> SwapResult:
        spot = self.spot()
        r = swap(amount_in, self.reserve_weth, self.reserve_usdx, fee_bps, protocol_fee_bps)
        self.reserve_weth, self.reserve_usdx = r.new_reserve_in, r.new_reserve_out
        self.treasury_weth += r.protocol_fee
        self.lp_fees_weth += r.lp_fee
        self.volume_usdx += int(amount_in * spot)
        return r

    def arbitrage(self, target_price: float, fee_bps: int = 0, protocol_fee_bps: int = 0):
        """Let an arbitrageur move the pool to target_price. Returns (direction, SwapResult) or (None, None)."""
        direction, amount = arbitrage_trade(self.reserve_usdx, self.reserve_weth, target_price, fee_bps)
        if direction is None or amount <= 0:
            return None, None
        if direction == "usdx_in":
            return direction, self.swap_usdx_in(amount, fee_bps, protocol_fee_bps)
        return direction, self.swap_weth_in(amount, fee_bps, protocol_fee_bps)

    def add_liquidity(self, usdx: int, weth: int) -> int:
        if self.total_shares == 0:
            shares = isqrt(usdx * weth)
        else:
            shares = min(usdx * self.total_shares // self.reserve_usdx, weth * self.total_shares // self.reserve_weth)
        self.reserve_usdx += usdx
        self.reserve_weth += weth
        self.total_shares += shares
        return shares

    def remove_liquidity(self, shares: int) -> tuple[int, int]:
        usdx = shares * self.reserve_usdx // self.total_shares
        weth = shares * self.reserve_weth // self.total_shares
        self.reserve_usdx -= usdx
        self.reserve_weth -= weth
        self.total_shares -= shares
        return usdx, weth

    # Valuations in USDX at an external price (USDX per WETH)
    def pool_value(self, price: float) -> float:
        return from_wei(self.reserve_usdx) + from_wei(self.reserve_weth) * price

    def share_value(self, shares: int, price: float) -> float:
        return self.pool_value(price) * shares / self.total_shares

    def lp_fee_value(self, price: float) -> float:
        return from_wei(self.lp_fees_usdx) + from_wei(self.lp_fees_weth) * price

    def treasury_value(self, price: float) -> float:
        return from_wei(self.treasury_usdx) + from_wei(self.treasury_weth) * price


# ---------------------------------------------------------------------------
# TWAP and dynamic fee selection
# ---------------------------------------------------------------------------


class Twap:
    """Time-weighted average of the pool spot over a trailing window.

    Mirrors a cumulative-price oracle: the spot is treated as constant between observations.
    value() returns None until the window is fully covered (warm-up), and the fee then falls
    back to the base tier.
    """

    def __init__(self, window_s: int = 1800):
        self.window = window_s
        self.obs: list[tuple[int, float]] = []

    def record(self, t: int, spot: float) -> None:
        self.obs.append((t, spot))
        # drop observations that no longer touch the window
        cutoff = t - self.window
        while len(self.obs) > 1 and self.obs[1][0] <= cutoff:
            self.obs.pop(0)

    def value(self, t: int):
        start = t - self.window
        if not self.obs or self.obs[0][0] > start:
            return None
        total = weight = 0.0
        for i, (ti, p) in enumerate(self.obs):
            t_next = self.obs[i + 1][0] if i + 1 < len(self.obs) else t
            lo, hi = max(ti, start), min(t_next, t)
            if hi > lo:
                total += p * (hi - lo)
                weight += hi - lo
        return total / weight if weight else None


def select_fee_bps(spot: float, twap, trigger: float = 0.01, base: int = BASE_FEE_BPS, high: int = HIGH_FEE_BPS,
                   reference=None, reference_trigger=None) -> int:
    """Dynamic tier as in AMMPool.getDynamicFeeStatus.

    Before the TWAP window has filled the base fee applies and no oracle is read. Afterwards the
    high fee applies if |spot / TWAP - 1| >= trigger, or if a fresh Chainlink reference is given
    and |TWAP / reference - 1| >= reference_trigger. Pass reference=None for a stale feed
    (the contract then falls back to the spot/TWAP signal alone).
    """
    if twap is None:
        return base
    if abs(spot / twap - 1) >= trigger:
        return high
    if reference is not None and reference_trigger is not None and abs(twap / reference - 1) >= reference_trigger:
        return high
    return base


# ---------------------------------------------------------------------------
# Price paths and the LP / fee simulation
# ---------------------------------------------------------------------------


def gbm_path(n_steps: int, step_s: int, sigma_annual: float, end_ratio: float, seed: int, start: float = 1.0):
    """Geometric Brownian motion pinned to a chosen end ratio (a Brownian bridge in log space).

    Pinning the end point keeps scenarios comparable: the final price is exactly start*end_ratio,
    while the path in between carries the chosen volatility.
    """
    import numpy as np

    rng = np.random.default_rng(seed)
    dt = step_s / (365 * 24 * 3600)
    z = rng.standard_normal(n_steps) * sigma_annual * math.sqrt(dt)
    logp = np.concatenate([[0.0], np.cumsum(z)])
    frac = np.linspace(0, 1, n_steps + 1)
    logp = logp + (math.log(end_ratio) - logp[-1]) * frac
    return start * np.exp(logp)


@dataclass
class SimConfig:
    step_s: int = 300  # 5-minute steps
    retail_volume_per_day: float = 20_000.0  # USDX traded by uninformed users, both directions
    retail_trades_per_day: int = 20
    dynamic_fee: bool = False
    trigger: float = 0.01  # |spot/TWAP - 1| above which the 0.50% tier applies
    twap_window_s: int = 1800
    demand_drop_at_high_fee: float = 0.0  # share of retail trades skipped while the high tier is active
    arb_enabled: bool = True
    tier_on_post_trade: bool = False  # choose the tier from the spot the trade would leave, not the pre-trade spot
    chainlink_trigger: float | None = 0.01  # |TWAP/Chainlink - 1| that also selects the high tier; None = signal off
    arb_extra_cost: float = 0.0  # arbitrageur's cost outside the pool (venue fee + slippage), fraction


def simulate(prices, pool: Pool, cfg: SimConfig, seed: int = 1):
    """Run a price path through the pool with arbitrage and retail flow.

    Each step: the external price moves; an arbitrageur trades the pool back to it (paying the
    active fee tier); a scheduled retail trade executes (direction alternates, size equal);
    the TWAP records the new spot. Retail cost is measured against the external price, so it
    includes fee, curve impact and any pool mispricing. Returns one row per step.
    """
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(seed)
    twap = Twap(cfg.twap_window_s)
    steps_per_day = 86_400 // cfg.step_s
    retail_every = max(1, steps_per_day // cfg.retail_trades_per_day)
    retail_size = cfg.retail_volume_per_day / cfg.retail_trades_per_day
    hold_usdx, hold_weth = from_wei(pool.reserve_usdx), from_wei(pool.reserve_weth)
    rows = []
    direction_buy = True
    for i, p in enumerate(prices):
        t = i * cfg.step_s

        def tier(spot_for_tier):
            return select_fee_bps(spot_for_tier, twap.value(t), cfg.trigger,
                                  reference=p if cfg.chainlink_trigger is not None else None,
                                  reference_trigger=cfg.chainlink_trigger)

        def active_fee():
            return tier(pool.spot()) if cfg.dynamic_fee else BASE_FEE_BPS

        fee = active_fee()
        high_now = fee == HIGH_FEE_BPS
        arb_volume = 0.0
        if cfg.arb_enabled:
            if cfg.dynamic_fee and cfg.tier_on_post_trade:
                # an arbitrage trade leaves the pool at the external price, so judge the tier from p
                fee = tier(p)
                high_now = fee == HIGH_FEE_BPS
            d, amount = arbitrage_trade(pool.reserve_usdx, pool.reserve_weth, p, fee, cfg.arb_extra_cost)
            if d == "usdx_in" and amount > 0:
                pool.swap_usdx_in(amount, fee, PROTOCOL_FEE_BPS)
                arb_volume = from_wei(amount)
            elif d == "weth_in" and amount > 0:
                pool.swap_weth_in(amount, fee, PROTOCOL_FEE_BPS)
                arb_volume = from_wei(amount) * p

        retail_volume = retail_cost = 0.0
        if retail_size > 0 and i % retail_every == 0 and i > 0:
            fee = active_fee()
            if cfg.dynamic_fee and cfg.tier_on_post_trade:
                # spot after the trade at the base fee, then pick the tier from that spot
                if direction_buy:
                    r0 = swap(to_wei(retail_size), pool.reserve_usdx, pool.reserve_weth, BASE_FEE_BPS, PROTOCOL_FEE_BPS)
                    spot_after = r0.new_reserve_in / r0.new_reserve_out
                else:
                    r0 = swap(to_wei(retail_size / p), pool.reserve_weth, pool.reserve_usdx, BASE_FEE_BPS, PROTOCOL_FEE_BPS)
                    spot_after = r0.new_reserve_out / r0.new_reserve_in
                fee = tier(spot_after)
            skipped = fee == HIGH_FEE_BPS and rng.random() < cfg.demand_drop_at_high_fee
            if not skipped:
                if direction_buy:
                    r = pool.swap_usdx_in(to_wei(retail_size), fee, PROTOCOL_FEE_BPS)
                    retail_cost = retail_size - from_wei(r.amount_out) * p
                else:
                    r = pool.swap_weth_in(to_wei(retail_size / p), fee, PROTOCOL_FEE_BPS)
                    retail_cost = retail_size - from_wei(r.amount_out)
                retail_volume = retail_size
                direction_buy = not direction_buy
                high_now = high_now or fee == HIGH_FEE_BPS

        twap.record(t, pool.spot())
        rows.append({
            "t_s": t, "price": p, "spot": pool.spot(), "fee_bps": fee, "high_tier": high_now,
            "arb_volume": arb_volume, "retail_volume": retail_volume, "retail_cost": retail_cost,
            "pool_value": pool.pool_value(p), "hold_value": hold_usdx + hold_weth * p,
            "lp_fees": pool.lp_fee_value(p), "protocol_revenue": pool.treasury_value(p),
        })
    return pd.DataFrame(rows)
