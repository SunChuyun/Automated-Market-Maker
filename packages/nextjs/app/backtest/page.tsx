"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowDownTrayIcon, PlayIcon } from "@heroicons/react/24/outline";
import { PoolResearch } from "~~/components/amm/PoolResearch";
import { ReturnChart } from "~~/components/amm/ResearchCharts";
import { Metric, PageHeading } from "~~/components/amm/Studio";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { number, usd } from "~~/utils/amm/model";
import { type Bar, STRATEGIES, type TestConfig, backtest, parseExpression } from "~~/utils/research/engine";

type Report = {
  result: ReturnType<typeof backtest>;
  config: TestConfig;
  name: string;
  source: string;
  frequency: string;
  created: number;
  warmup: number;
};
const iso = (d: number) => new Date(d).toISOString().slice(0, 10);
const utc = (s: string) => Date.parse(`${s}T00:00:00Z`);
const duration = (ms: number) =>
  ms >= 86400000 ? `${number(ms / 86400000, 1)} days` : `${number(ms / 3600000, 1)} hours`;
function download(rows: (string | number | null)[][], name: string) {
  const text = rows.map(r => r.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function BacktestPage() {
  const [mode, setMode] = useState("pool");
  return (
    <div className="studio-page research-page">
      <PageHeading
        eyebrow="STRATEGY RESEARCH"
        title="Explore a trade before making it."
        description="Study pool price gaps or test a simple indicator strategy."
      />
      <div className="tabs studio-tabs research-toolbar" role="tablist" aria-label="Research mode">
        {[
          ["pool", "Pool arbitrage"],
          ["technical", "Indicator strategies"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            className={`tab ${mode === id ? "tab-active" : ""}`}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "pool" ? <PoolResearch /> : <IndicatorResearch />}
    </div>
  );
}
function IndicatorResearch() {
  const { address } = useAccount(),
    { targetNetwork } = useTargetNetwork();
  const key = `amm-research-v1:${targetNetwork.id}:${address?.toLowerCase() ?? "guest"}`;
  const [strategy, setStrategy] = useState("sma"),
    [entry, setEntry] = useState(STRATEGIES[0].entry),
    [exit, setExit] = useState(STRATEGIES[0].exit);
  const [today, setToday] = useState("");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [frequency, setFrequency] = useState("1d");
  const [capital, setCapital] = useState("10000"),
    [allocation, setAllocation] = useState("100"),
    [fee, setFee] = useState("0.30"),
    [slippage, setSlippage] = useState("0.05"),
    [gas, setGas] = useState("0");
  const [report, setReport] = useState<Report | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [chart, setChart] = useState("returns"),
    [saved, setSaved] = useState(false);
  const results = useRef<HTMLDivElement>(null),
    requestId = useRef(0);
  useEffect(() => {
    const now = Date.now();
    setToday(iso(now));
    setEnd(iso(now));
    setStart(iso(now - 365 * 86400000));
  }, []);
  useEffect(() => {
    requestId.current++;
    setBusy(false);
    setReport(null);
    setSaved(false);
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? "null");
      if (old?.result?.points?.length && old?.config) {
        setReport(old);
        setSaved(true);
      }
    } catch {
      /* Optional local research history. */
    }
  }, [key]);
  const choose = (id: string) => {
    setStrategy(id);
    const p = STRATEGIES.find(s => s.id === id);
    if (p) {
      setEntry(p.entry);
      setExit(p.exit);
    }
  };
  const run = async () => {
    setError("");
    setBusy(true);
    const id = ++requestId.current;
    try {
      parseExpression(entry);
      parseExpression(exit);
      const config: TestConfig = {
        capital: Number(capital),
        allocation: Number(allocation) / 100,
        fee: Number(fee) / 100,
        slippage: Number(slippage) / 100,
        gas: Number(gas),
        entry,
        exit,
        start: utc(start),
        end: utc(end),
      };
      if (!Number.isFinite(config.start) || !Number.isFinite(config.end) || config.end <= config.start)
        throw new Error("Choose an end date after the start date.");
      if (config.capital > 1e8 || !Number.isFinite(config.capital) || config.capital <= 0)
        throw new Error("Starting capital must be between 0 and 100,000,000 USD.");
      const warmup =
        frequency === "1M"
          ? 40 * 31 * 86400000
          : 200 * ({ "1m": 60000, "5m": 300000, "1h": 3600000, "1d": 86400000 }[frequency] ?? 86400000);
      const from = Math.max(Date.UTC(2016, 0, 1), config.start - warmup);
      const params = new URLSearchParams({
        start: new Date(from).toISOString(),
        end: new Date(config.end).toISOString(),
        frequency,
      });
      const res = await fetch(`/api/backtest/candles?${params}`, { signal: AbortSignal.timeout(90000) }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "History unavailable.");
      if (data.gaps > 0)
        throw new Error(
          `Provider returned ${data.gaps} gaps. Choose a different range; missing candles will not be filled with invented data.`,
        );
      if (id !== requestId.current) return;
      const bars: Bar[] = data.bars,
        result = backtest(bars, config);
      if (id !== requestId.current) return;
      if (result.readyBars === 0)
        throw new Error(
          "The selected indicators never completed warm-up. Use shorter indicator periods or a longer history.",
        );
      const next = {
        result,
        config,
        name: STRATEGIES.find(s => s.id === strategy)?.name ?? "Custom expressions",
        source: data.source,
        frequency,
        created: Date.now(),
        warmup: bars.filter(b => b.end <= config.start).length,
      };
      setReport(next);
      setPage(0);
      setSaved(false);
      setChart("returns");
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setSaved(true);
      } catch {
        /* A completed run remains usable if storage is full. */
      }
      requestAnimationFrame(() =>
        results.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        }),
      );
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const r = report?.result;
  return (
    <div>
      <section className="card studio-card research-builder">
        <div className="section-head">
          <h2>Strategy configuration</h2>
          <span className="muted">ETH / USD reference market</span>
        </div>
        <div className="research-form-grid">
          <label>
            Strategy
            <select className="select" aria-label="Strategy" value={strategy} onChange={e => choose(e.target.value)}>
              {STRATEGIES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="custom">Custom expressions</option>
            </select>
          </label>
          <label>
            Start date (UTC)
            <input
              className="input"
              aria-label="Start date"
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
            />
          </label>
          <label>
            End date (exclusive, UTC)
            <input
              className="input"
              aria-label="End date"
              type="date"
              value={end}
              max={today}
              onChange={e => setEnd(e.target.value)}
            />
          </label>
          <label>
            Data frequency
            <select
              className="select"
              aria-label="Data frequency"
              value={frequency}
              onChange={e => {
                setFrequency(e.target.value);
                const days = { "1m": 2, "5m": 7, "1h": 90, "1d": 365, "1M": 1095 }[e.target.value] ?? 365;
                setStart(iso(utc(end) - days * 86400000));
              }}
            >
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
              <option value="1M">1 month</option>
            </select>
          </label>
          <label>
            Starting capital (USD)
            <input
              className="input"
              type="number"
              aria-label="Starting capital"
              value={capital}
              onChange={e => setCapital(e.target.value)}
            />
          </label>
          <label>
            Cash allocated per entry (%)
            <input
              className="input"
              type="number"
              min="1"
              max="100"
              value={allocation}
              onChange={e => setAllocation(e.target.value)}
            />
          </label>
          <label>
            Trading fee per side (%)
            <input
              className="input"
              type="number"
              min="0"
              max="5"
              step=".01"
              value={fee}
              onChange={e => setFee(e.target.value)}
            />
          </label>
          <label>
            Adverse slippage per side (%)
            <input
              className="input"
              type="number"
              min="0"
              max="5"
              step=".01"
              value={slippage}
              onChange={e => setSlippage(e.target.value)}
            />
          </label>
          <label>
            Gas per order (USD)
            <input
              className="input"
              type="number"
              min="0"
              step=".01"
              value={gas}
              onChange={e => setGas(e.target.value)}
            />
          </label>
        </div>
        <div className="strategy-code-head">
          <div>
            <h3>Signals & execution rules</h3>
            <p>
              {STRATEGIES.find(s => s.id === strategy)?.description ??
                "Compose your own entry and exit conditions using the supported indicator functions."}
            </p>
          </div>
          <span className="badge">Indicator expressions · TypeScript engine</span>
        </div>
        <div className="strategy-code-grid">
          <label>
            Entry condition → Buy with allocated cash
            <textarea
              className="textarea strategy-editor"
              aria-label="Entry condition"
              spellCheck={false}
              value={entry}
              onChange={e => {
                setEntry(e.target.value);
                setStrategy("custom");
              }}
            />
          </label>
          <label>
            Exit condition → Sell the entire position
            <textarea
              className="textarea strategy-editor"
              aria-label="Exit condition"
              spellCheck={false}
              value={exit}
              onChange={e => {
                setExit(e.target.value);
                setStrategy("custom");
              }}
            />
          </label>
        </div>
        <details className="research-methodology">
          <summary>Expression syntax, data limits & execution model</summary>
          <p>
            Variables: open, high, low, close, volume. Indicators: sma(n), ema(n), rsi(n), upper(n, k), lower(n, k),
            macd(fast, slow), signal(fast, slow, n). Helpers: crossAbove(a, b), crossBelow(a, b). Operators: + - * /
            &gt; &lt; &gt;= &lt;= == != &amp;&amp; || !. Periods: 1–200 bars. Edit numeric arguments to tune a strategy.
          </p>
          <p>
            Expressions are parsed locally; arbitrary JavaScript and Python are not executed. A Python notebook or an
            isolated Python worker can be integrated later. Indicators use completed candles; fills occur at the next
            bar&apos;s open. Long positions are closed at the final completed close. No interest on cash. The benchmark
            includes the same fee, slippage and gas on entry and exit.
          </p>
          <p>
            Public Coinbase Exchange candles; monthly bars are aggregated from complete UTC calendar months. Up to 6,000
            source bars per run including warm-up (200 bars; up to 40 calendar months for monthly tests). Missing bars
            stop the run. This is a market-price backtest with constant assumed costs, not a replay of our AMM&apos;s
            reserves, order flow or fee income.
          </p>
        </details>
        <div className="research-run-row">
          <p>Signal at close → Order at next open → Fees & costs → Portfolio valuation</p>
          <button className="btn btn-primary" disabled={busy || !start || !end} onClick={() => void run()}>
            <PlayIcon className="h-5 w-5" />
            {busy ? "Fetching candles & running…" : "Run backtest"}
          </button>
        </div>
        {error && (
          <div className="alert alert-error research-error" role="alert">
            {error}
          </div>
        )}
      </section>
      <div ref={results} className="research-results" aria-live="polite">
        {report && r ? (
          <>
            <div className="section-head">
              <div>
                <div className="eyebrow">PERFORMANCE REPORT</div>
                <h2>{report.name}</h2>
                <p className="body-copy">
                  {iso(r.points[0].time)} — {iso(r.points.at(-1)!.time)} · {report.frequency} · {r.bars} completed bars
                  · {report.source}
                </p>
              </div>
              <span className="badge">{saved ? "Saved in this browser" : "Current run"}</span>
            </div>
            <div className="research-metrics">
              {[
                ["Total return", `${number(r.returnPct * 100)}%`, `Ending equity ${usd(r.points.at(-1)!.value)}`],
                ["Sharpe ratio", r.sharpe === null ? "—" : number(r.sharpe), "Annualized · 365-day market · Rf = 0"],
                ["Maximum drawdown", `${number(r.maxDrawdown * 100)}%`, "Peak-to-trough equity loss"],
                ["Longest drawdown", duration(r.longestDrawdown), "Peak to recovery, or test end"],
                ["Buy & hold", `${number(r.holdReturn * 100)}%`, "Same capital and cost assumptions"],
                [
                  "Win rate",
                  r.winRate === null ? "—" : `${number(r.winRate * 100)}%`,
                  `${r.closed} closed round trips`,
                ],
                [
                  "Profit factor",
                  r.profitFactor === null ? "—" : number(r.profitFactor),
                  "Net winning P&L / net losing P&L",
                ],
                ["Total fees & gas", usd(r.fees + r.gas), `${usd(r.slippage)} additional modeled slippage`],
              ].map(([label, value, detail]) => (
                <Metric key={label} label={label} value={value} detail={detail} />
              ))}
            </div>
            <section className="card studio-card">
              <div className="section-head">
                <h2>{chart === "returns" ? "Cumulative return" : "Drawdown"}</h2>
                <div className="tabs studio-tabs" role="tablist" aria-label="Performance chart">
                  {["returns", "drawdown"].map(t => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={chart === t}
                      className={`tab ${chart === t ? "tab-active" : ""}`}
                      onClick={() => setChart(t)}
                    >
                      {t === "returns" ? "Returns" : "Drawdown"}
                    </button>
                  ))}
                </div>
              </div>
              <ReturnChart points={r.points} drawdown={chart === "drawdown"} />
              <div className="chart-legend">
                <span>
                  <i />
                  Strategy · Net of modeled costs
                </span>
                <span>● Buy & hold</span>
                <span>Both start at 0% before the first fill</span>
              </div>
            </section>
            <section className="card studio-card">
              <div className="section-head">
                <h2>Trades & execution log</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    download(
                      [
                        [
                          "time_utc",
                          "side",
                          "price_usd",
                          "quantity_eth",
                          "notional_usd",
                          "fee_usd",
                          "fee_rate_pct",
                          "gas_usd",
                          "slippage_usd",
                          "realized_pnl_usd",
                          "reason",
                        ],
                        ...r.trades.map(t => [
                          new Date(t.time).toISOString(),
                          t.side,
                          t.price,
                          t.quantity,
                          t.notional,
                          t.fee,
                          report.config.fee * 100,
                          t.gas,
                          t.slippage,
                          t.pnl,
                          t.reason,
                        ]),
                      ],
                      "strategy-trades.csv",
                    )
                  }
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export all trades
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="table studio-table research-trades">
                  <thead>
                    <tr>
                      {[
                        "Time (UTC)",
                        "Side",
                        "Fill price",
                        "ETH quantity",
                        "Fee / rate",
                        "Gas",
                        "Realized P&L",
                        "Reason",
                      ].map(v => (
                        <th key={v}>{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.trades.slice(page * 20, page * 20 + 20).map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.time).toISOString().slice(0, 16).replace("T", " ")}</td>
                        <td>
                          <span className={`badge ${t.side === "Buy" ? "trade-buy" : "trade-sell"}`}>{t.side}</span>
                        </td>
                        <td>{usd(t.price)}</td>
                        <td>{number(t.quantity, 6)}</td>
                        <td>
                          {usd(t.fee)} / {number(report.config.fee * 100)}%
                        </td>
                        <td>{usd(t.gas)}</td>
                        <td>{t.pnl === null ? "—" : usd(t.pnl)}</td>
                        <td>{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.trades.length && (
                  <p className="body-copy">
                    No signals generated a trade in this window. Try a different strategy, period or threshold.
                  </p>
                )}
              </div>
              <div className="research-pagination">
                <span>
                  {r.trades.length} orders · {r.rejected} skipped for insufficient order value
                </span>
                <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(r.trades.length / 20))}
                </span>
                <button
                  className="btn btn-sm"
                  disabled={(page + 1) * 20 >= r.trades.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </section>
            <details className="card studio-card research-analysis">
              <summary>Position analysis & reproducibility</summary>
              <div className="metrics-grid three">
                <Metric
                  label="Market exposure"
                  value={`${number(r.exposure * 100)}%`}
                  detail="Fraction of test bars holding ETH"
                />
                <Metric
                  label="Annualized volatility"
                  value={`${number(r.volatility * 100)}%`}
                  detail="Based on net equity returns"
                />
                <Metric
                  label="Realized net P&L"
                  value={usd(r.realized)}
                  detail="Includes entry and exit fees and gas"
                />
              </div>
              <h3>Run configuration</h3>
              <pre>
                {JSON.stringify(
                  {
                    start: new Date(report.config.start).toISOString(),
                    end: new Date(report.config.end).toISOString(),
                    frequency: report.frequency,
                    source: report.source,
                    entry: report.config.entry,
                    exit: report.config.exit,
                    capital: report.config.capital,
                    allocation: report.config.allocation,
                    fee: report.config.fee,
                    slippage: report.config.slippage,
                    gasPerOrder: report.config.gas,
                    warmupBars: report.warmup,
                    barsWithReadyIndicators: r.readyBars,
                  },
                  null,
                  2,
                )}
              </pre>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  download(
                    [
                      ["time_utc", "equity_usd", "cash_usd", "eth_units", "strategy_return", "hold_return", "drawdown"],
                      ...r.points.map(p => [
                        new Date(p.time).toISOString(),
                        p.value,
                        p.cash,
                        p.units,
                        p.strategy,
                        p.hold,
                        p.drawdown,
                      ]),
                    ],
                    "strategy-positions.csv",
                  )
                }
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export bar-by-bar positions
              </button>
              <div className="overflow-x-auto">
                <table className="table studio-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Cash</th>
                      <th>ETH units</th>
                      <th>Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.points.slice(-10).map(p => (
                      <tr key={p.time}>
                        <td>{new Date(p.time).toISOString().slice(0, 16).replace("T", " ")}</td>
                        <td>{usd(p.cash)}</td>
                        <td>{number(p.units, 6)}</td>
                        <td>{usd(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="form-caption">
                Latest ten valuation points. CSV contains the complete run. Re-run to apply edits above; the displayed
                report retains its original settings.
              </p>
            </details>
          </>
        ) : (
          <section className="card studio-card research-empty">
            <div className="eyebrow">FROM IDEA TO EVIDENCE</div>
            <h2>Your results start with a question.</h2>
            <p>Choose a strategy or write an expression, then run it against completed market candles.</p>
            <div>
              <span>01 · Define signals</span>
              <span>02 · Model costs</span>
              <span>03 · Compare outcomes</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
