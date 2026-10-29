"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowPathIcon, ArrowRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { ReserveCurve } from "~~/components/amm/ResearchCharts";
import { LineChart, Metric, Note, PageHeading, PairTitle } from "~~/components/amm/Studio";
import { usePaperAccount } from "~~/hooks/usePaperAccount";
import { impermanentLoss, number, quoteSwap } from "~~/utils/amm/model";
import { rangePosition } from "~~/utils/amm/risk";

export default function SimulatePage() {
  const { account: a, ready, scope, execute, reset, setDepth } = usePaperAccount();
  const [depth, setDepthInput] = useState("1");
  const [tab, setTab] = useState("trade"),
    [buy, setBuy] = useState(true),
    [input, setInput] = useState("1000");
  const [lpAmount, setLpAmount] = useState("0.5"),
    [withdraw, setWithdraw] = useState(false);
  const [reference, setReference] = useState("2500"),
    [twap, setTwap] = useState("2500"),
    [age, setAge] = useState("60");
  const [warmup, setWarmup] = useState("30"),
    [slippage, setSlippage] = useState("0.5"),
    [maxFee, setMaxFee] = useState("0.5");
  const [dynamic, setDynamic] = useState(false),
    [reviewed, setReviewed] = useState(""),
    [message, setMessage] = useState("");
  const spot = a.poolUsdx / a.poolWeth,
    amount = Number(input),
    ref = Number(reference),
    avg = Number(twap);
  const deviation = avg > 0 ? Math.abs(spot / avg - 1) : NaN;
  const fee = dynamic && deviation > 0.01 ? 0.005 : 0.003;
  const q = quoteSwap(amount, buy ? a.poolUsdx : a.poolWeth, buy ? a.poolWeth : a.poolUsdx, fee);
  const tradeW = q ? (buy ? a.poolWeth - q.output : a.poolWeth + amount * (1 - 0.0005)) : a.poolWeth;
  const tradeU = q ? (buy ? a.poolUsdx + amount * (1 - 0.0005) : a.poolUsdx - q.output) : a.poolUsdx;
  const lpInput = Number(lpAmount);
  const lpValid =
    Number.isFinite(lpInput) &&
    lpInput > 0 &&
    (withdraw ? lpInput <= a.shares : lpInput <= a.weth && lpInput * spot <= a.usdx);
  const nextW =
    tab === "trade"
      ? tradeW
      : lpValid
        ? withdraw
          ? a.poolWeth * (1 - lpInput / a.totalShares)
          : a.poolWeth + lpInput
        : a.poolWeth;
  const nextU =
    tab === "trade"
      ? tradeU
      : lpValid
        ? withdraw
          ? a.poolUsdx * (1 - lpInput / a.totalShares)
          : a.poolUsdx + lpInput * spot
        : a.poolUsdx;
  const composition = ((a.poolWeth * ref) / (a.poolWeth * ref + a.poolUsdx)) * 100;
  const validRisk =
    [ref, avg, Number(age), Number(warmup), Number(slippage), Number(maxFee)].every(Number.isFinite) &&
    ref > 0 &&
    avg > 0 &&
    Number(age) >= 0 &&
    Number(age) <= 90 &&
    Number(warmup) >= 30 &&
    Number(slippage) >= 0 &&
    Number(slippage) <= 5 &&
    Number(maxFee) >= fee * 100 &&
    Number(maxFee) <= 5;
  const insufficient = amount > (buy ? a.usdx : a.weth);
  const fingerprint = JSON.stringify([a, input, buy, reference, twap, age, warmup, slippage, maxFee, dynamic]);
  const perform = () => {
    try {
      execute(buy ? "buy" : "sell", amount, fee);
      setReviewed("");
      setMessage("Paper swap recorded. View balances and activity in Portfolio.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const lpValue = (a.shares / a.totalShares) * (a.poolUsdx + a.poolWeth * ref);
  return (
    <div className="studio-page research-page">
      <PageHeading
        eyebrow="RISK LAB"
        title="See the risk before the trade."
        description="Explore execution, pool exposure and liquidity scenarios before committing capital."
        action={<span className="badge simulation-badge">Paper account</span>}
      />
      <div className="research-toolbar">
        <div className="tabs studio-tabs" role="tablist" aria-label="Simulation tools">
          {[
            ["trade", "Trade simulation"],
            ["liquidity", "Paper liquidity"],
            ["lp", "LP risk scenarios"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? "tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            reset();
            setMessage("Paper account reset.");
            setReviewed("");
          }}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Reset paper account
        </button>
      </div>
      {tab === "lp" ? (
        <LpRisk />
      ) : (
        <>
          <div className="metrics-grid three">
            <Metric label="Pool spot price" value={`${number(spot)} USDX`} detail="Per WETH · Paper reserves" />
            <Metric
              label="Your paper assets"
              value={`${number(a.weth, 4)} WETH`}
              detail={`${number(a.usdx)} USDX available`}
            />
            <Metric
              label="Your paper LP position"
              value={`${number(a.shares, 4)} shares`}
              detail={`${number(lpValue)} USDX at the scenario reference`}
            />
          </div>
          <div className="risk-workspace">
            <section className="card studio-card risk-order">
              <div className="section-head">
                <PairTitle />
                <span className="badge">{tab === "trade" ? "Trade" : "Liquidity"}</span>
              </div>
              {tab === "trade" ? (
                <>
                  <div className="tabs studio-tabs mt-6" role="tablist" aria-label="Paper trade direction">
                    {[true, false].map(v => (
                      <button
                        className={`tab ${buy === v ? "tab-active" : ""}`}
                        role="tab"
                        aria-selected={buy === v}
                        key={String(v)}
                        onClick={() => {
                          setBuy(v);
                          setInput(v ? "1000" : "0.5");
                        }}
                      >
                        {v ? "Buy WETH" : "Sell WETH"}
                      </button>
                    ))}
                  </div>
                  <label className="form-label" htmlFor="virtual-amount">
                    You pay
                  </label>
                  <div className="unit-input">
                    <input
                      id="virtual-amount"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                    />
                    <span>{buy ? "USDX" : "WETH"}</span>
                  </div>
                  <div className="simulation-output">
                    <span>Estimated received</span>
                    <strong>
                      {q ? number(q.output, 6) : "—"} <small>{buy ? "WETH" : "USDX"}</small>
                    </strong>
                  </div>
                  <div className="quote-details">
                    <div>
                      <span>Price impact · fee excluded</span>
                      <strong className={q && q.impact > 0.03 ? "risk-danger" : ""}>
                        {q ? `${number(q.impact * 100, 3)}%` : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Trading fee</span>
                      <strong>{number(fee * 100)}%</strong>
                    </div>
                    <div>
                      <span>LP / protocol split</span>
                      <strong>{number((fee - 0.0005) * 100)}% / 0.05%</strong>
                    </div>
                    <div>
                      <span>Minimum received</span>
                      <strong>
                        {q && validRisk
                          ? `${number(q.output * (1 - Number(slippage) / 100), 6)} ${buy ? "WETH" : "USDX"}`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  <div className="risk-review">
                    <div className="section-head">
                      <h3>
                        <ShieldCheckIcon className="h-5 w-5" />
                        Pre-trade risk review
                      </h3>
                      <span
                        className={`badge ${!validRisk || insufficient ? "risk-danger" : q && q.impact > 0.03 ? "risk-warning" : ""}`}
                      >
                        {!validRisk
                          ? "Check settings"
                          : insufficient
                            ? "Balance exceeded"
                            : q && q.impact > 0.03
                              ? "High impact"
                              : "Within scenario limits"}
                      </span>
                    </div>
                    <p>
                      {!validRisk
                        ? "Use positive reference prices, feed age 0–90 minutes, at least 30 minutes of TWAP history, slippage 0–5%, and a fee cap covering the selected tier."
                        : q && q.impact > 0.03
                          ? "This trade materially moves the pool price. Reduce the order or increase pool depth before proceeding."
                          : "Review the output and reserves below. The selected tolerance sets a minimum output, not a guaranteed fill."}
                    </p>
                    <p>
                      USDX is an unbacked test token. Gas, MEV and external arbitrage are excluded from this paper fill.
                    </p>
                  </div>
                  {insufficient && <p className="field-error">Insufficient paper {buy ? "USDX" : "WETH"}.</p>}
                  <button
                    className="btn btn-primary primary-action"
                    disabled={!ready || !q || insufficient || !validRisk}
                    onClick={() => (reviewed === fingerprint ? perform() : setReviewed(fingerprint))}
                  >
                    {reviewed === fingerprint ? "Confirm paper swap" : "Review paper swap"}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                  {reviewed === fingerprint && (
                    <p className="form-caption">Review acknowledged. Confirming changes this paper account only.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="tabs studio-tabs mt-6" role="tablist" aria-label="Paper liquidity action">
                    {[false, true].map(v => (
                      <button
                        role="tab"
                        aria-selected={withdraw === v}
                        className={`tab ${withdraw === v ? "tab-active" : ""}`}
                        key={String(v)}
                        onClick={() => {
                          setWithdraw(v);
                          setLpAmount(v ? String(a.shares) : "0.5");
                        }}
                      >
                        {v ? "Withdraw" : "Add liquidity"}
                      </button>
                    ))}
                  </div>
                  <label className="form-label" htmlFor="paper-lp-amount">
                    {withdraw ? "LP shares to redeem" : "WETH to deposit"}
                  </label>
                  <div className="unit-input">
                    <input
                      id="paper-lp-amount"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={lpAmount}
                      onChange={e => setLpAmount(e.target.value)}
                    />
                    <span>{withdraw ? "shares" : "WETH"}</span>
                  </div>
                  <div className="quote-details">
                    {withdraw ? (
                      <>
                        <div>
                          <span>WETH returned</span>
                          <strong>{number((Number(lpAmount) / a.totalShares) * a.poolWeth, 6)}</strong>
                        </div>
                        <div>
                          <span>USDX returned</span>
                          <strong>{number((Number(lpAmount) / a.totalShares) * a.poolUsdx)}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span>Matching USDX required</span>
                          <strong>{number(Number(lpAmount) * spot)}</strong>
                        </div>
                        <div>
                          <span>Paper LP shares received</span>
                          <strong>{number((Number(lpAmount) * a.totalShares) / a.poolWeth, 6)}</strong>
                        </div>
                        <div>
                          <span>Your resulting pool share</span>
                          <strong>
                            {number(
                              ((a.shares + (Number(lpAmount) * a.totalShares) / a.poolWeth) /
                                (a.totalShares + (Number(lpAmount) * a.totalShares) / a.poolWeth)) *
                                100,
                              3,
                            )}
                            %
                          </strong>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="risk-review">
                    <h3>Liquidity risk review</h3>
                    <p>
                      Your redeemable quantities change with swaps. Fee income may not offset impermanent loss. These
                      are full-range paper shares, without gas costs.
                    </p>
                    <Link className="text-link" href="/portfolio">
                      View paper positions & activity in Portfolio →
                    </Link>
                  </div>
                  <button
                    className="btn btn-primary primary-action"
                    disabled={
                      !ready ||
                      !Number.isFinite(Number(lpAmount)) ||
                      Number(lpAmount) <= 0 ||
                      (withdraw
                        ? Number(lpAmount) > a.shares
                        : Number(lpAmount) > a.weth || Number(lpAmount) * spot > a.usdx)
                    }
                    onClick={() => {
                      try {
                        execute(withdraw ? "withdraw" : "deposit", Number(lpAmount));
                        setMessage("Paper liquidity updated. Position and history saved in Portfolio.");
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    {withdraw ? "Redeem paper LP shares" : "Confirm paper deposit"}
                  </button>
                </>
              )}
              <p className="form-caption" role="status">
                {message || `${scope} · Saved in this browser`}
              </p>
            </section>
            <div className="risk-visuals">
              <section className="card studio-card">
                <div className="section-head">
                  <h2>Pool reserves & execution</h2>
                  <span className="badge">Constant product</span>
                </div>
                <ReserveCurve weth={a.poolWeth} usdx={a.poolUsdx} nextWeth={nextW} nextUsdx={nextU} />
                <div className="chart-legend">
                  <span>
                    <i />
                    Before trade
                  </span>
                  <span className="after-legend">● After trade · LP fees retained</span>
                </div>
                <div className="reserve-comparison">
                  <span>
                    Spot before <strong>{number(spot)} USDX</strong>
                  </span>
                  <span>
                    Spot after <strong>{number(nextU / nextW)} USDX</strong>
                  </span>
                </div>
              </section>
              <section className="card studio-card">
                <div className="section-head">
                  <h2>Assets in the pool</h2>
                  <span className="muted">Value at scenario reference</span>
                </div>
                <div
                  className="asset-distribution"
                  role="img"
                  aria-label={`WETH ${number(composition)} percent of pool value`}
                >
                  <div style={{ width: `${Number.isFinite(composition) ? composition : 50}%` }} />
                  <div />
                </div>
                <div className="reserve-comparison">
                  <span>
                    WETH <strong>{number(a.poolWeth, 4)} WETH</strong>
                    <small>{number(composition)}% of reference value</small>
                  </span>
                  <span>
                    USDX <strong>{number(a.poolUsdx)} USDX</strong>
                    <small>{number(100 - composition)}% of reference value</small>
                  </span>
                </div>
              </section>
            </div>
          </div>
          <details className="card studio-card scenario-settings">
            <summary>Scenario controls & oracle stress tests</summary>
            <p className="body-copy">
              Manual inputs, not a live Chainlink feed. USD comparisons assume 1 USDX = 1 USD.
            </p>
            <div className="depth-control">
              <label>
                Starting pool depth multiplier
                <input
                  className="input"
                  aria-label="Pool depth multiplier"
                  type="number"
                  min=".01"
                  max="1000"
                  step=".1"
                  value={depth}
                  onChange={e => setDepthInput(e.target.value)}
                />
              </label>
              <button
                className="btn btn-sm"
                onClick={() => {
                  try {
                    setDepth(Number(depth));
                    setReviewed("");
                    setMessage("Pool depth applied; paper balances, LP positions and history reset.");
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Apply depth &amp; reset paper account
              </button>
            </div>
            <div className="research-form-grid">
              {[
                ["Reference ETH / USD", reference, setReference],
                ["Pool TWAP (USDX / WETH)", twap, setTwap],
                ["Feed age (minutes)", age, setAge],
                ["TWAP history (minutes)", warmup, setWarmup],
                ["Slippage tolerance (%)", slippage, setSlippage],
                ["Maximum fee (%)", maxFee, setMaxFee],
              ].map(([label, value, setter]) => (
                <label key={String(label)}>
                  {String(label)}
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={String(value)}
                    onChange={e => (setter as (s: string) => void)(e.target.value)}
                  />
                </label>
              ))}
            </div>
            <label className="form-label">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={dynamic}
                onChange={e => setDynamic(e.target.checked)}
              />{" "}
              Dynamic fee scenario · 0.30% / 0.50%
            </label>
            <p className="form-caption">
              Illustrative trigger: spot/TWAP deviation above 1%. The threshold requires team validation. Feed age above
              90 minutes or TWAP warm-up below 30 minutes blocks paper swaps.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

function LpRisk() {
  const [move, setMove] = useState(50),
    [volume, setVolume] = useState("100000"),
    [days, setDays] = useState("30"),
    [gas, setGas] = useState("10");
  const [lower, setLower] = useState("1800"),
    [upper, setUpper] = useState("3500");
  const ratio = 1 + move / 100,
    final = 2500 * ratio,
    valid =
      [Number(volume), Number(days), Number(gas)].every(Number.isFinite) &&
      Number(volume) >= 0 &&
      Number(days) > 0 &&
      Number(gas) >= 0;
  const fees = valid ? Number(volume) * 0.0025 * 0.1 : 0,
    hold = 5000 * (1 + ratio),
    lp = 10000 * Math.sqrt(ratio) + fees - (valid ? Number(gas) : 0);
  const range = rangePosition(10000, 2500, Number(lower), Number(upper), final);
  const ratios = Array.from({ length: 57 }, (_, i) => 0.2 + i * 0.05);
  return (
    <>
      <div className="metrics-grid three">
        <Metric
          label="Full-range LP ending value"
          value={valid ? `${number(lp)} USDX` : "—"}
          detail="Includes assumed fees and gas"
        />
        <Metric label="Hold initial assets" value={`${number(hold)} USDX`} detail="Same initial 50/50 position" />
        <Metric
          label="Impermanent loss"
          value={`${number(impermanentLoss(ratio) * 100)}%`}
          detail="Versus hold · Before fees and gas"
        />
      </div>
      <div className="risk-workspace">
        <section className="card studio-card">
          <h2>LP profitability scenario</h2>
          <p className="body-copy">
            10,000 USDX initial position · 10% of the pool · Arbitrage rebalances to the scenario price.
          </p>
          <label className="form-label" htmlFor="lp-price-move">
            WETH price change: {move > 0 ? "+" : ""}
            {move}%
          </label>
          <input
            className="range range-primary"
            id="lp-price-move"
            type="range"
            min="-80"
            max="200"
            step="5"
            value={move}
            onChange={e => setMove(Number(e.target.value))}
          />
          {[
            ["Horizon (days)", days, setDays],
            ["Total pool volume over horizon (USDX)", volume, setVolume],
            ["Your assumed gas cost (USDX)", gas, setGas],
          ].map(([label, value, setter]) => (
            <label className="form-label" key={String(label)}>
              {String(label)}
              <input
                className="input"
                type="number"
                min="0"
                value={String(value)}
                onChange={e => (setter as (s: string) => void)(e.target.value)}
              />
            </label>
          ))}
          <div className="quote-details">
            <div>
              <span>Your assumed LP fee income</span>
              <strong>{number(fees)} USDX</strong>
            </div>
            <div>
              <span>LP minus hold</span>
              <strong>{valid ? number(lp - hold) : "—"} USDX</strong>
            </div>
            <div>
              <span>Protocol revenue · Whole pool</span>
              <strong>{number(Number(volume) * 0.0005)} USDX</strong>
            </div>
          </div>
          <Note>
            Volume is a total for the selected horizon, not a daily rate. Constant share, 0.25% LP fee, no fee
            compounding; price history alone cannot determine fee income.
          </Note>
        </section>
        <section className="card studio-card">
          <h2>Impermanent loss versus hold</h2>
          <LineChart
            values={ratios.map(r => impermanentLoss(r) * 100)}
            labels={ratios.map(r => `${number((r - 1) * 100)}% price change`)}
            label="IL (%)"
            unit="%"
            caption="Fee-free full-range position"
          />
          <div className="risk-review">
            <h3>What can change the outcome?</h3>
            <p>
              Lower volume, adverse price moves, gas and changing pool share can outweigh fee income. This endpoint
              model assumes external arbitrage; it does not replay individual trades.
            </p>
          </div>
        </section>
      </div>
      <section className="card studio-card range-scenario">
        <div className="section-head">
          <h2>Price range exploration</h2>
          <span className="badge scenario-badge">Design study · Contract support pending</span>
        </div>
        <p className="body-copy">
          Explore a concentrated position separately from the current full-range AMM. A range is not a stop-loss: beyond
          its bounds the position becomes one-sided and stops earning swap fees until price re-enters.
        </p>
        <div className="research-form-grid">
          <label>
            Lower price (USDX / WETH)
            <input className="input" type="number" value={lower} onChange={e => setLower(e.target.value)} />
          </label>
          <label>
            Upper price (USDX / WETH)
            <input className="input" type="number" value={upper} onChange={e => setUpper(e.target.value)} />
          </label>
          <div className="range-status">
            <span>Scenario terminal price</span>
            <strong>{number(final)} USDX</strong>
            <span className="badge">{range ? (range.active ? "In range" : "Out of range") : "Invalid range"}</span>
          </div>
        </div>
        {range ? (
          <>
            <div className="range-track">
              <span
                style={{
                  left: `${Math.max(0, Math.min(100, ((final - Number(lower)) / (Number(upper) - Number(lower))) * 100))}%`,
                }}
              />
            </div>
            <div className="metrics-grid three">
              <Metric
                label="Terminal WETH"
                value={number(range.weth, 6)}
                detail={`${number(range.usdx)} USDX alongside`}
              />
              <Metric
                label="Range position value"
                value={`${number(range.value)} USDX`}
                detail="No fees or gas modeled"
              />
              <Metric
                label="Versus its initial assets held"
                value={`${number(range.relative * 100)}%`}
                detail="Benchmark uses the range position's own initial mix"
              />
            </div>
          </>
        ) : (
          <p className="field-error">Choose a positive lower bound below 2,500 and an upper bound above 2,500.</p>
        )}
        <p className="form-caption">
          Idealized concentrated-liquidity inventory math only. Requires a different position model and contract
          integration; selecting bounds here does not change your actual pool.
        </p>
      </section>
    </>
  );
}
