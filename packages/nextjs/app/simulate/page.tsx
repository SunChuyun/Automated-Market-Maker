"use client";

import { useState } from "react";
import { ArrowPathIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { LineChart, Metric, Note, PageHeading, PairTitle } from "~~/components/amm/Studio";
import { EXAMPLE_POOL, impermanentLoss, number, quoteSwap } from "~~/utils/amm/model";

const initial = { weth: 1, usdx: 10000, poolWeth: EXAMPLE_POOL.weth, poolUsdx: EXAMPLE_POOL.usdx };
type VirtualTrade = { side: string; input: number; output: number; from: string; to: string };

export default function SimulatePage() {
  const [tab, setTab] = useState("paper");
  return (
    <div className="studio-page">
      <PageHeading
        eyebrow="THE PRACTICE LAB"
        title="Try it. Learn the mechanics."
        description="A sandbox for swaps, price impact, and liquidity decisions. No wallet or gas required."
        action={<span className="badge simulation-badge">Virtual assets only</span>}
      />
      <div className="tabs studio-tabs workspace-tabs" role="tablist" aria-label="Simulation tools">
        {[
          { id: "paper", name: "Paper trading" },
          { id: "impact", name: "Price impact" },
          { id: "lp", name: "LP scenarios" },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      {tab === "paper" ? <PaperTrading /> : tab === "impact" ? <Impact /> : <LpScenarios />}
    </div>
  );
}

function PaperTrading() {
  const [account, setAccount] = useState(initial);
  const [buy, setBuy] = useState(true);
  const [input, setInput] = useState("1000");
  const [trades, setTrades] = useState<VirtualTrade[]>([]);
  const [message, setMessage] = useState("");
  const amount = Number(input);
  const from = buy ? "USDX" : "WETH";
  const to = buy ? "WETH" : "USDX";
  const quote = quoteSwap(amount, buy ? account.poolUsdx : account.poolWeth, buy ? account.poolWeth : account.poolUsdx);
  const insufficient = amount > (buy ? account.usdx : account.weth);
  const execute = () => {
    if (!quote || insufficient) return;
    // Protocol fees leave the pool; the LP portion remains in reserves.
    const retainedInput = amount * (1 - 0.0005);
    setAccount(
      buy
        ? {
            weth: account.weth + quote.output,
            usdx: account.usdx - amount,
            poolWeth: account.poolWeth - quote.output,
            poolUsdx: account.poolUsdx + retainedInput,
          }
        : {
            weth: account.weth - amount,
            usdx: account.usdx + quote.output,
            poolWeth: account.poolWeth + retainedInput,
            poolUsdx: account.poolUsdx - quote.output,
          },
    );
    setTrades([{ side: buy ? "Buy WETH" : "Sell WETH", input: amount, output: quote.output, from, to }, ...trades]);
    setMessage(`Virtual swap complete: received ${number(quote.output, 6)} ${to}.`);
  };
  return (
    <>
      <div className="metrics-grid three">
        <Metric label="Virtual USDX" value={number(account.usdx)} detail="Starting balance: 10,000 USDX" />
        <Metric label="Virtual WETH" value={number(account.weth, 6)} detail="Starting balance: 1 WETH" />
        <Metric
          label="Virtual pool spot"
          value={number(account.poolUsdx / account.poolWeth)}
          detail="USDX per WETH · Moves after your swaps"
        />
      </div>
      <div className="lab-layout">
        <section className="card studio-card">
          <div className="section-head">
            <PairTitle />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setAccount(initial);
                setTrades([]);
                setMessage("Virtual session reset.");
              }}
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reset
            </button>
          </div>
          <div className="tabs studio-tabs mt-6" role="tablist" aria-label="Virtual trade direction">
            <button
              role="tab"
              aria-selected={buy}
              className={`tab ${buy ? "tab-active" : ""}`}
              onClick={() => setBuy(true)}
            >
              Buy WETH
            </button>
            <button
              role="tab"
              aria-selected={!buy}
              className={`tab ${!buy ? "tab-active" : ""}`}
              onClick={() => setBuy(false)}
            >
              Sell WETH
            </button>
          </div>
          <label className="form-label" htmlFor="virtual-amount">
            Amount to spend
          </label>
          <div className="unit-input">
            <input
              className="input"
              id="virtual-amount"
              type="number"
              min="0"
              step="any"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <span>{from}</span>
          </div>
          <div className="quote-details">
            <div>
              <span>Estimated output</span>
              <strong>{quote ? number(quote.output, 6) + " " + to : "—"}</strong>
            </div>
            <div>
              <span>Price impact (excl. fee)</span>
              <strong>{quote ? number(quote.impact * 100, 3) + "%" : "—"}</strong>
            </div>
            <div>
              <span>Virtual fee</span>
              <strong>0.30%</strong>
            </div>
          </div>
          {insufficient && <p className="field-error">Insufficient virtual {from}.</p>}
          <button className="btn btn-primary primary-action" disabled={!quote || insufficient} onClick={execute}>
            Execute virtual swap <ArrowRightIcon className="h-4 w-4" />
          </button>
          <p className="form-caption" role="status">
            {message || "Session only. Leaving this tool resets its virtual balances."}
          </p>
        </section>
        <section className="card studio-card">
          <div className="section-head">
            <h2>Virtual activity</h2>
            <span className="badge">{trades.length} swaps</span>
          </div>
          {trades.length ? (
            <div className="virtual-trades">
              {trades.slice(0, 5).map((t, i) => (
                <div key={trades.length - i}>
                  <span className="activity-icon">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <strong>{t.side}</strong>
                    <small>
                      {number(t.input, 6)} {t.from} → {number(t.output, 6)} {t.to}
                    </small>
                  </div>
                  <span className="badge simulation-badge">Virtual</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-symbol">↔</span>
              <h3>Your first move starts here.</h3>
              <p>Place a virtual trade to see balances, reserves and price impact change.</p>
            </div>
          )}
          <Note>
            Example starting reserves: 100 WETH / 250,000 USDX. This sandbox uses the base fee only, without gas, an
            oracle, or external arbitrage.
          </Note>
        </section>
      </div>
    </>
  );
}

function Impact() {
  const [input, setInput] = useState("1");
  const quote = quoteSwap(Number(input), 100, 250000);
  const sizes = Array.from({ length: 40 }, (_, i) => (i + 1) * 0.5);
  return (
    <div className="lab-layout">
      <section className="card studio-card">
        <div className="eyebrow">TRADE SIZE VS. LIQUIDITY</div>
        <h2 className="mt-3">Larger trades move the price.</h2>
        <p className="body-copy">
          A constant-product pool gives progressively less output per unit as a trade consumes its reserves.
        </p>
        <label className="form-label" htmlFor="impact-amount">
          WETH sold into the example pool
        </label>
        <div className="unit-input">
          <input
            className="input"
            id="impact-amount"
            type="number"
            min="0"
            step="any"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <span>WETH</span>
        </div>
        <div className="quote-details">
          <div>
            <span>USDX received</span>
            <strong>{quote ? number(quote.output) : "—"}</strong>
          </div>
          <div>
            <span>Curve price impact</span>
            <strong>{quote ? number(quote.impact * 100, 3) + "%" : "—"}</strong>
          </div>
          <div>
            <span>Swap fee, shown separately</span>
            <strong>0.30%</strong>
          </div>
        </div>
        <Note>
          Fixed example reserves: 100 WETH / 250,000 USDX. Price impact compares the fee-adjusted execution rate with
          the pre-trade reserve ratio.
        </Note>
      </section>
      <section className="card studio-card">
        <div className="section-head">
          <h2>Impact curve</h2>
          <span className="badge simulation-badge">Example pool</span>
        </div>
        <LineChart
          values={sizes.map(s => quoteSwap(s, 100, 250000)!.impact * 100)}
          labels={sizes.map(s => `${s} WETH`)}
          label="Impact (%)"
          unit="%"
          caption="Example trade sizes"
        />
        <div className="overflow-x-auto">
          <table className="table studio-table">
            <thead>
              <tr>
                <th>WETH in</th>
                <th>USDX out</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {[0.1, 1, 5, 10].map(s => {
                const q = quoteSwap(s, 100, 250000)!;
                return (
                  <tr key={s}>
                    <td>{s}</td>
                    <td>{number(q.output)}</td>
                    <td>{number(q.impact * 100, 3)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LpScenarios() {
  const [move, setMove] = useState(50);
  const [volume, setVolume] = useState("100000");
  const ratio = 1 + move / 100;
  const safeVolume = Number.isFinite(Number(volume)) ? Math.min(1e12, Math.max(0, Number(volume))) : 0;
  const fees = safeVolume * 0.0025 * 0.1;
  const hold = 5000 * (1 + ratio);
  const lp = 10000 * Math.sqrt(ratio) + fees;
  const ratios = Array.from({ length: 57 }, (_, i) => 0.2 + i * 0.05);
  return (
    <>
      <div className="metrics-grid three">
        <Metric label="LP ending value" value={number(lp) + " USDX"} detail="Includes the assumed LP fee income" />
        <Metric label="Hold ending value" value={number(hold) + " USDX"} detail="Same initial 50 / 50 position" />
        <Metric
          label="Impermanent loss"
          value={number(impermanentLoss(ratio) * 100, 2) + "%"}
          detail="Relative to holding, before fee income"
        />
      </div>
      <div className="lab-layout">
        <section className="card studio-card">
          <h2>Set your scenario</h2>
          <p className="body-copy">
            Start with a 10,000 USDX-equivalent position, split equally between WETH and USDX.
          </p>
          <label className="form-label" htmlFor="lp-price-move">
            WETH price change{" "}
            <strong>
              {move > 0 ? "+" : ""}
              {move}%
            </strong>
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
          <label className="form-label" htmlFor="lp-volume">
            Assumed pool volume during the period
          </label>
          <div className="unit-input">
            <input
              className="input"
              id="lp-volume"
              max="1000000000000"
              type="number"
              min="0"
              value={volume}
              onChange={e => setVolume(e.target.value)}
            />
            <span>USDX</span>
          </div>
          <div className="quote-details">
            <div>
              <span>Assumed constant LP share</span>
              <strong>10%</strong>
            </div>
            <div>
              <span>Your modeled LP fees</span>
              <strong>{number(fees)} USDX</strong>
            </div>
            <div>
              <span>LP minus hold, after fees</span>
              <strong className={lp < hold ? "negative" : "positive"}>{number(lp - hold)} USDX</strong>
            </div>
          </div>
        </section>
        <section className="card studio-card">
          <h2>LP vs. holding</h2>
          <LineChart
            values={ratios.map(r => 10000 * Math.sqrt(r) + fees)}
            comparison={ratios.map(r => 5000 * (1 + r))}
            labels={ratios.map(r => `${Math.round((r - 1) * 100)}% price move`)}
            label="LP (USDX)"
            caption="Price scenarios"
          />
          <div className="chart-legend">
            <span>
              <i />
              LP including fees
            </span>
            <span>
              <i />
              Hold
            </span>
          </div>
          <Note>
            Assumes frictionless arbitrage, a 0.25% LP fee, constant 10% ownership, and fees added at period end. No gas
            or compounding. USDX = USD is a modeling assumption, not a peg.
          </Note>
        </section>
      </div>
    </>
  );
}
