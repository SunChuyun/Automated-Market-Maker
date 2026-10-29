"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { PairTitle, PendingButton, Token } from "~~/components/amm/Studio";
import { number } from "~~/utils/amm/model";
import { feeApr } from "~~/utils/explore/data";

export default function EarnPage() {
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("0.5");
  const [percent, setPercent] = useState(25);
  const [volume, setVolume] = useState("100000");
  const [tvl, setTvl] = useState("500000");
  const [fee, setFee] = useState(0.0025);
  const weth = Number.isFinite(Number(amount)) ? Math.min(1e12, Math.max(0, Number(amount))) : 0;
  const valid = [Number(volume), Number(tvl)].every(Number.isFinite) && Number(volume) >= 0 && Number(tvl) > 0;
  const apr = valid ? feeApr(Number(volume), Number(tvl), fee) : null;
  return (
    <div className="studio-page earn-page">
      <div className="earn-hero">
        <span className="badge">Liquidity, made clear</span>
        <h1>
          Make every swap
          <br />
          work for you.
        </h1>
        <p>
          Provide WETH and USDX.
          <br />
          Earn your share of the pool&apos;s trading fees.
        </p>
        <a href="#liquidity" className="btn btn-primary">
          Explore liquidity <ArrowUpRightIcon className="h-4 w-4" />
        </a>
        <div className="earn-hero-tokens">
          <Token symbol="WETH" />
          <Token symbol="USDX" />
          <span>
            One pool.
            <br />
            Shared opportunity.
          </span>
        </div>
      </div>
      <div className="earn-layout">
        <div>
          <section className="earn-opportunity">
            <div className="section-head">
              <h2>Your liquidity opportunity</h2>
              <span className="badge">Contract pending</span>
            </div>
            <div className="earn-pool-row">
              <PairTitle />
              <span className="badge">Constant product</span>
            </div>
            <div className="earn-pool-stats">
              <div>
                <span>LP fee · Base tier</span>
                <strong>0.25%</strong>
              </div>
              <div>
                <span>Live fee APR</span>
                <strong>—</strong>
              </div>
              <div>
                <span>Pool liquidity</span>
                <strong>—</strong>
              </div>
            </div>
            <p className="functional-note">Live returns will appear after the pool has volume and liquidity data.</p>
          </section>
          <section className="card apr-calculator">
            <div className="section-head">
              <h2>What could fees earn?</h2>
              <span className="badge scenario-badge">Example scenario</span>
            </div>
            <div className="apr-value">
              {apr === null ? "—" : number(apr * 100)}
              <span>{apr === null ? "" : "%"}</span>
            </div>
            <p className="apr-label">Illustrative fee APR</p>
            <div className="apr-inputs">
              <label>
                Daily pool volume
                <div className="unit-input">
                  <input
                    className="input"
                    aria-label="Daily pool volume"
                    type="number"
                    min="0"
                    value={volume}
                    onChange={e => setVolume(e.target.value)}
                  />
                  <span>USDX</span>
                </div>
              </label>
              <label>
                Total pool value
                <div className="unit-input">
                  <input
                    className="input"
                    aria-label="Total pool value"
                    type="number"
                    min="1"
                    value={tvl}
                    onChange={e => setTvl(e.target.value)}
                  />
                  <span>USDX</span>
                </div>
              </label>
            </div>
            <label className="apr-tier">
              Fee tier
              <select
                className="select"
                value={fee}
                aria-label="LP fee tier"
                onChange={e => setFee(Number(e.target.value))}
              >
                <option value={0.0025}>0.30% swap · 0.25% to LPs</option>
                <option value={0.0045}>0.50% swap · 0.45% to LPs</option>
              </select>
            </label>
            <details className="earn-disclosure">
              <summary>How this estimate works</summary>
              <p>
                Annualized fee income = daily volume × LP fee × 365 ÷ pool value. The default example assumes 100,000
                USDX in daily volume and 500,000 USDX in liquidity. This is simple APR, without compounding, impermanent
                loss or gas. It is not an observed or guaranteed return.
              </p>
            </details>
          </section>
          <div className="earn-explain">
            <h2>
              A share of the pool.
              <br />A share of the fees.
            </h2>
            <p>
              LP tokens represent your ownership. A larger share receives more of the same pool fee income. Fees accrue
              in the reserves and are reflected in your redeemable share.
            </p>
            <Link className="text-link" href="/simulate">
              Explore LP risk scenarios <ArrowUpRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <section id="liquidity" className="card studio-card liquidity-form earn-deposit">
          <div className="tabs studio-tabs" role="tablist" aria-label="Liquidity action">
            {["add", "remove"].map(m => (
              <button
                className={`tab ${mode === m ? "tab-active" : ""}`}
                role="tab"
                aria-selected={mode === m}
                key={m}
                onClick={() => setMode(m)}
              >
                {m === "add" ? "Add liquidity" : "Withdraw"}
              </button>
            ))}
          </div>
          <div className="section-head">
            <h2>WETH / USDX</h2>
            <span className="badge">Preview</span>
          </div>
          {mode === "add" ? (
            <>
              <label className="form-label" htmlFor="lp-weth">
                WETH deposit
              </label>
              <div className="unit-input">
                <input
                  className="input"
                  id="lp-weth"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <span>WETH</span>
              </div>
              <label className="form-label">Matching USDX</label>
              <div className="calculated-amount">
                {number(weth * 2500)}
                <span>USDX</span>
              </div>
              <div className="quote-details">
                <div>
                  <span>Estimated example pool share</span>
                  <strong>{number((weth / (100 + weth)) * 100, 3)}%</strong>
                </div>
                <div>
                  <span>LP token amount</span>
                  <strong>Awaiting contract</strong>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="functional-note">Example position: 1 WETH + 2,500 USDX</p>
              <label className="form-label" htmlFor="remove-percent">
                Withdraw {percent}%
              </label>
              <input
                className="range range-primary"
                id="remove-percent"
                type="range"
                min="1"
                max="100"
                value={percent}
                onChange={e => setPercent(Number(e.target.value))}
              />
              <div className="percent-buttons">
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${percent === p ? "selected" : ""}`}
                    onClick={() => setPercent(p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <div className="quote-details">
                <div>
                  <span>WETH returned</span>
                  <strong>{number(percent / 100, 4)} WETH</strong>
                </div>
                <div>
                  <span>USDX returned</span>
                  <strong>{number((2500 * percent) / 100)} USDX</strong>
                </div>
              </div>
            </>
          )}
          <PendingButton>Pool contract pending</PendingButton>
          <p className="functional-note">
            Deposits and withdrawals are not connected yet. Your resulting LP shares, redeemable assets and activity
            will appear in{" "}
            <Link className="text-link" href="/portfolio">
              Portfolio
            </Link>
            .
          </p>
          <Link className="text-link" href="/simulate">
            Practice a deposit in Simulation →
          </Link>
          <details className="earn-disclosure">
            <summary>Example amounts & risks</summary>
            <p>
              Calculator reserves: 100 WETH / 250,000 USDX. These are not wallet balances. USDX is an unbacked test
              token. Providing liquidity carries price, impermanent-loss and contract risk.
            </p>
          </details>
        </section>
      </div>
    </div>
  );
}
