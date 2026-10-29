"use client";
import { useRef, useState } from "react";
import { PlayIcon } from "@heroicons/react/24/outline";
import { ReturnChart } from "~~/components/amm/ResearchCharts";
import { Metric } from "~~/components/amm/Studio";
import { number } from "~~/utils/amm/model";
import { DEMO_PRICES, type Observation, type PoolConfig, parsePriceCsv, runPoolResearch } from "~~/utils/research/pool";

export function PoolResearch() {
  const [source, setSource] = useState("Example price path"),
    [prices, setPrices] = useState<Observation[]>(DEMO_PRICES),
    [error, setError] = useState("");
  const [inputs, setInputs] = useState({
    weth: "100",
    usdx: "250000",
    capital: "10000",
    orderCap: "1000",
    poolFee: "0.30",
    externalFee: "0.10",
    slippage: "0.05",
    gas: "1",
    minProfit: "1",
    minEdge: "0.5",
  });
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [page, setPage] = useState(0);
  const [report, setReport] = useState<{
      result: ReturnType<typeof runPoolResearch>;
      config: PoolConfig;
      source: string;
    } | null>(null),
    results = useRef<HTMLDivElement>(null);
  const run = () => {
    try {
      setError("");
      const config = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, Number(v)])) as PoolConfig;
      for (const key of ["poolFee", "externalFee", "slippage", "minEdge"] as const) config[key] /= 100;
      const from = start ? Date.parse(start + "T00:00:00Z") : -Infinity,
        to = end ? Date.parse(end + "T00:00:00Z") : Infinity;
      if (from >= to) throw new Error("The end date must follow the start date.");
      const data = prices.filter(p => p.time >= from && p.time < to);
      const result = runPoolResearch(data, config);
      setReport({ result, config, source });
      setPage(0);
      requestAnimationFrame(() =>
        results.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const r = report?.result;
  return (
    <>
      <section className="card studio-card research-builder">
        <div className="section-head">
          <h2>Pool arbitrage scenario</h2>
          <span className="badge">Browser-only engine</span>
        </div>
        <p className="body-copy">
          Compare WETH / USDX pool quotes with an assumed external venue. Trades change the paper reserves and move the
          pool price toward the reference.
        </p>
        <div className="risk-review">
          <h3>First, establish a tradable route</h3>
          <p>
            USDX currently has no external market or redemption. This study assumes 1 USDX = 1 USD and a venue that can
            settle the same assets. An ETH/USD price feed alone does not create an executable arbitrage route.
          </p>
        </div>
        <div className="research-form-grid">
          {Object.entries(inputs).map(([key, value]) => (
            <label key={key}>
              {
                (
                  {
                    weth: "Starting WETH reserves",
                    usdx: "Starting USDX reserves",
                    capital: "Starting cash (USDX)",
                    orderCap: "Maximum cash per round trip",
                    poolFee: "Pool fee (%)",
                    externalFee: "External venue fee (%)",
                    slippage: "External adverse slippage (%)",
                    gas: "Gas per round trip (USDX)",
                    minProfit: "Minimum net profit (USDX)",
                    minEdge: "Minimum spot deviation (%)",
                  } as Record<string, string>
                )[key]
              }
              <input
                className="input"
                type="number"
                step="any"
                value={value}
                onChange={e => setInputs({ ...inputs, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            From date (UTC, optional)
            <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label>
            Until date (exclusive UTC, optional)
            <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>
        <div className="local-data-row">
          <div>
            <h3>Reference observations</h3>
            <p>
              {source} · {prices.length} observations · {new Date(prices[0].time).toISOString().slice(0, 10)} —{" "}
              {new Date(prices.at(-1)!.time).toISOString().slice(0, 10)}
            </p>
          </div>
          <label className="btn btn-sm">
            Import local CSV
            <input
              aria-label="Import reference CSV"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 1000000) throw new Error("Use a CSV smaller than 1 MB.");
                  const next = parsePriceCsv(await file.text());
                  setPrices(next);
                  setSource(file.name);
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPrices(DEMO_PRICES);
              setSource("Example price path");
              setStart("");
              setEnd("");
            }}
          >
            Use example
          </button>
        </div>
        <details className="research-methodology">
          <summary>How to test, CSV format & model assumptions</summary>
          <p>
            Click Run with the example first. Increase gas or the minimum profit to filter opportunities; reduce pool
            depth to see smaller profitable trade sizes. Import timestamp,price CSV data (ISO timestamps with timezone,
            or Unix seconds/milliseconds) to use your own observations. Files stay in your browser; no upload or server
            computation occurs. The example is synthetic, not historical market data.
          </p>
          <pre>
            timestamp,price{"\n"}2026-01-01T00:00:00Z,2500{"\n"}2026-01-01T01:00:00Z,2600{"\n"}2026-01-01T02:00:00Z,2450
          </pre>
          <p>
            At each observation, estimate both directions after constant-product price impact, pool/venue fees, adverse
            external slippage and gas. Trade only above the deviation and net-profit thresholds. Order size is the
            analytical profit-maximizing amount, capped by cash and the order limit. No future price is used. Each
            modeled round trip starts and ends in USDX cash. Pool protocol share is fixed at 0.05%; remaining pool fees
            stay in LP reserves.
          </p>
          <p>
            Instant external hedging, fixed costs and no competing arbitrageurs are assumed. Failed transactions,
            latency, MEV, bridging, depeg and changing order books can erase an apparent profit. The model can therefore
            show zero drawdown; that is not evidence of a risk-free strategy. Reserves are scenario inputs, not live
            pool history.
          </p>
        </details>
        <div className="research-run-row">
          <p>Observe → Quote both venues → Deduct costs → Trade only if profitable</p>
          <button className="btn btn-primary" onClick={run}>
            <PlayIcon className="h-5 w-5" />
            Run pool scenario
          </button>
        </div>
        {error && (
          <div className="alert alert-error research-error" role="alert">
            {error}
          </div>
        )}
      </section>
      <div className="research-results" ref={results} aria-live="polite">
        {r && report && (
          <>
            <div className="section-head">
              <h2>Pool scenario results</h2>
              <span className="badge">{report.source}</span>
            </div>
            <div className="research-metrics">
              {[
                [
                  "Net simulated P&L",
                  `${number(r.profit)} USDX`,
                  `${number((r.profit / report.config.capital) * 100)}% net return`,
                ],
                ["Completed round trips", String(r.trades.length), "Both legs are simulated"],
                ["Routed pool volume", `${number(r.poolVolume)} USDX`, "One pool leg per round trip"],
                [
                  "Modeled LP / protocol fees",
                  `${number(r.lpFees)} / ${number(r.protocolFees)}`,
                  "USDX equivalent · Not realized revenue",
                ],
              ].map(([label, value, detail]) => (
                <Metric key={label} label={label} value={value} detail={detail} />
              ))}
            </div>
            <section className="card studio-card">
              <h2>Net return versus buying & holding WETH</h2>
              <ReturnChart points={r.points} />
              <div className="chart-legend">
                <span>
                  <i />
                  Simulated arbitrage
                </span>
                <span>● Buy & hold WETH</span>
                <span>Both begin at 0% · Same starting cash</span>
              </div>
              <p className="form-caption">
                {!r.holdLiquidated &&
                  "Benchmark remains marked to market because exit gas would exceed sale proceeds. "}
                These have different market exposure. The arbitrage model ends each round trip in cash; holding WETH
                bears price risk.
              </p>
            </section>
            <section className="card studio-card">
              <div className="section-head">
                <h2>Opportunity & execution log</h2>
                <span className="muted">Final pool spot: {number(r.usdx / r.weth)} USDX / WETH</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table studio-table research-trades">
                  <thead>
                    <tr>
                      {[
                        "Time (UTC)",
                        "Route",
                        "Reference",
                        "Pool before → after",
                        "Cash used",
                        "WETH traded",
                        "Pool fee",
                        "Venue fee",
                        "Gas",
                        "Price impact",
                        "Net profit",
                      ].map(v => (
                        <th key={v}>{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.trades.slice(page * 20, page * 20 + 20).map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.time).toISOString().slice(0, 16).replace("T", " ")}</td>
                        <td>{t.direction}</td>
                        <td>{number(t.reference)}</td>
                        <td>
                          {number(t.before)} → {number(t.after)}
                        </td>
                        <td>{number(t.input)}</td>
                        <td>{number(t.weth, 6)}</td>
                        <td>{number(t.poolFee, 4)}</td>
                        <td>{number(t.externalFee, 4)}</td>
                        <td>{number(t.gas)}</td>
                        <td>{number(t.impact * 100, 3)}%</td>
                        <td>{number(t.profit, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.trades.length && (
                  <p className="body-copy">
                    No round trip exceeded both thresholds after costs. Try lower gas or a larger reference-price move.
                  </p>
                )}
              </div>
              <div className="research-pagination">
                <span>Fees, cash and P&L in USDX equivalent.</span>
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
          </>
        )}
      </div>
    </>
  );
}
