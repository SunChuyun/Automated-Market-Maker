"use client";

import { useState } from "react";
import { ArrowDownTrayIcon, PlayIcon } from "@heroicons/react/24/outline";
import { LineChart, Metric, Note, PageHeading } from "~~/components/amm/Studio";
import { useMarketHistory } from "~~/hooks/useMarket";
import { number, runDca, usd } from "~~/utils/amm/model";

type Run = { result: NonNullable<ReturnType<typeof runDca>>; capital: number; days: number; interval: number };
export default function BacktestPage() {
  const history = useMarketHistory();
  const [capital, setCapital] = useState("10000");
  const [days, setDays] = useState(7);
  const [interval, setInterval] = useState(24);
  const [run, setRun] = useState<Run | null>(null);
  const valid = Number.isFinite(Number(capital)) && Number(capital) > 0 && Number(capital) <= 100000000;
  const runTest = () => {
    if (!history.data || !valid) return;
    const result = runDca(history.data.candles.slice(-days * 24), Number(capital), interval);
    if (result) setRun({ result, capital: Number(capital), days, interval });
  };
  const download = () => {
    if (!run) return;
    const rows = [
      "timestamp_utc,eth_usd_close,eth_purchased,fee_usd",
      ...run.result.trades.map(t => `${new Date(t.time).toISOString()},${t.price},${t.amount},${t.fee}`),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "amm-studio-reference-backtest.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="studio-page">
      <PageHeading
        eyebrow="HISTORICAL RESEARCH"
        title="Give your strategy some history."
        description="Compare scheduled ETH purchases with buying and holding, using real market candles."
        action={<span className="badge preview-badge">Reference-market model</span>}
      />
      <div className="backtest-layout">
        <section className="card studio-card backtest-controls">
          <div className="eyebrow">STRATEGY BUILDER</div>
          <h2 className="mt-3">Periodic buying</h2>
          <p className="body-copy">Split your capital into equal purchases over the selected window.</p>
          <label className="form-label" htmlFor="backtest-capital">
            Starting capital
          </label>
          <div className="unit-input">
            <input
              className="input"
              id="backtest-capital"
              type="number"
              min="1"
              max="100000000"
              value={capital}
              onChange={e => setCapital(e.target.value)}
            />
            <span>USD</span>
          </div>
          <label className="form-label" htmlFor="backtest-window">
            Historical window
          </label>
          <select className="select" id="backtest-window" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last ~30 days</option>
          </select>
          <label className="form-label" htmlFor="backtest-interval">
            Buy every
          </label>
          <select
            className="select"
            id="backtest-interval"
            value={interval}
            onChange={e => setInterval(Number(e.target.value))}
          >
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>7 days</option>
          </select>
          <div className="quote-details">
            <div>
              <span>Modeled purchase fee</span>
              <strong>0.30%</strong>
            </div>
            <div>
              <span>Data resolution</span>
              <strong>1 hour</strong>
            </div>
            <div>
              <span>Price source</span>
              <strong>Kraken ETH/USD</strong>
            </div>
          </div>
          <button
            className="btn btn-primary primary-action"
            disabled={!valid || !history.data || history.isError}
            onClick={runTest}
          >
            <PlayIcon className="h-4 w-4" />
            {history.isPending ? "Loading history…" : "Run backtest"}
          </button>
          {!valid && <p className="field-error">Enter capital between 1 and 100,000,000 USD.</p>}
          {history.isError && (
            <p className="field-error">
              History unavailable.{" "}
              <button className="text-link" onClick={() => void history.refetch()}>
                Retry data
              </button>
            </p>
          )}
          <p className="form-caption">
            {history.data
              ? `${history.data.candles.length} completed candles available. Run again to apply edited inputs.`
              : "Waiting for historical candles."}
          </p>
        </section>
        <div className="backtest-results">
          {run ? (
            <>
              <div className="metrics-grid three compact">
                <Metric
                  label="Strategy return"
                  value={number(run.result.returnPct * 100) + "%"}
                  detail={`Ending value ${usd(run.result.finalValue)}`}
                />
                <Metric
                  label="Buy & hold return"
                  value={number((run.result.holdValue / run.capital - 1) * 100) + "%"}
                  detail="Entire capital invested at the first close"
                />
                <Metric
                  label="Max. drawdown"
                  value={number(run.result.maxDrawdown * 100) + "%"}
                  detail="Strategy equity · Includes idle cash"
                />
              </div>
              <section className="card studio-card">
                <div className="section-head">
                  <h2>Portfolio value</h2>
                  <button className="btn btn-ghost btn-sm" onClick={download}>
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    CSV
                  </button>
                </div>
                <p className="chart-caption">
                  {usd(run.capital)} · {run.days}-day window · Purchase every {run.interval} hours
                </p>
                <LineChart
                  values={run.result.points.map(p => p.value)}
                  comparison={run.result.points.map(p => p.hold)}
                  labels={run.result.points.map(p =>
                    new Date(p.time).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  )}
                  label="Strategy (USD)"
                  caption="Hourly portfolio value"
                />
                <div className="chart-legend">
                  <span>
                    <i />
                    Periodic buying
                  </span>
                  <span>
                    <i />
                    Buy & hold
                  </span>
                </div>
              </section>
              <section className="card studio-card">
                <div className="section-head">
                  <h2>Purchase log</h2>
                  <span className="muted">
                    {run.result.trades.length} purchases · {usd(run.result.fees)} in fees
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="table studio-table">
                    <thead>
                      <tr>
                        <th>Time (UTC)</th>
                        <th>ETH / USD</th>
                        <th>ETH purchased</th>
                        <th>Fee (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.result.trades
                        .slice(-5)
                        .toReversed()
                        .map(t => (
                          <tr key={t.time}>
                            <td>{new Date(t.time).toISOString().slice(5, 16).replace("T", " ")}</td>
                            <td>{usd(t.price)}</td>
                            <td>{number(t.amount, 6)}</td>
                            <td>{usd(t.fee)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="form-caption">Showing the latest five purchases. Download CSV for the complete run.</p>
              </section>
            </>
          ) : (
            <section className="card studio-card backtest-empty">
              <div className="empty-state">
                <span className="empty-symbol">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                <span className="eyebrow">YOUR NEXT EXPERIMENT</span>
                <h2>
                  A strategy is a question.
                  <br />
                  Let the data answer.
                </h2>
                <p>
                  Choose your capital, window and schedule.
                  <br />
                  Run a backtest to compare the outcomes.
                </p>
              </div>
              <div className="empty-legend">
                <span>01 · Real hourly candles</span>
                <span>02 · Fees included</span>
                <span>03 · Compare with hold</span>
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="mt-6">
        <Note>
          Research preview, not a pool backtest: trades execute at completed hourly ETH/USD closes with a fixed 0.30%
          purchase fee. No gas, spread, market impact, LP fees or reserve changes. Idle cash earns no interest. The
          unfinished candle is excluded. The final AMM analysis must use the deployed pool and reconcile with Sepolia.
        </Note>
      </div>
    </div>
  );
}
