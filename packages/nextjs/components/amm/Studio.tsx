"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  BeakerIcon,
  InformationCircleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useMarket, useMarketHistory } from "~~/hooks/useMarket";
import { number, usd } from "~~/utils/amm/model";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Token({ symbol, size = "normal" }: { symbol: string; size?: "normal" | "small" }) {
  return (
    <span className={`token token-${symbol.toLowerCase()} ${size === "small" ? "token-small" : ""}`} aria-hidden="true">
      {symbol === "WETH" ? "♦" : "$"}
    </span>
  );
}

export function PairTitle() {
  return (
    <div className="pair-title">
      <span className="token-pair">
        <Token symbol="WETH" />
        <Token symbol="USDX" />
      </span>
      <span>
        WETH <span className="muted">/</span> USDX
      </span>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-note">
      <InformationCircleIcon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

export function PendingButton({ children = "Pool contract pending" }: { children?: React.ReactNode }) {
  return (
    <button type="button" className="btn btn-primary primary-action" disabled>
      <LockClosedIcon className="h-4 w-4" />
      {children}
    </button>
  );
}

export function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function LineChart({
  values,
  comparison,
  labels,
  label = "Price",
  compareLabel = "Hold",
  caption = "Hourly close",
  unit = "USD",
}: {
  values: number[];
  comparison?: number[];
  labels?: string[];
  label?: string;
  compareLabel?: string;
  caption?: string;
  unit?: string;
}) {
  const id = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return <div className="chart-placeholder">Chart appears when price history is available.</div>;
  const all = [...values, ...(comparison ?? [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || max * 0.01 || 1;
  const y = (n: number) => 24 + ((max - n) / range) * 160;
  const x = (i: number) => (i / (values.length - 1)) * 640 + 12;
  const path = (series: number[]) =>
    series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  return (
    <div className="line-chart">
      <div className="chart-readout">
        {hover !== null ? (
          <>
            <span>{labels?.[hover]}</span>
            <strong>
              {label} {number(values[hover])}
              {comparison ? ` · ${compareLabel} ${number(comparison[hover])}` : ` ${unit}`}
            </strong>
          </>
        ) : (
          <>
            <span>{label}</span>
            <strong>{caption}</strong>
          </>
        )}
      </div>
      <svg
        viewBox="0 0 720 214"
        role="img"
        aria-label={`${label}: ${number(values[0])} to ${number(values.at(-1)!)}. ${comparison ? `Compared with ${compareLabel}.` : ""}`}
        onPointerMove={e => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(((((e.clientX - box.left) / box.width) * 720 - 12) / 640) * (values.length - 1)),
              ),
            ),
          );
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#5967df" stopOpacity="0.13" />
            <stop offset="1" stopColor="#5967df" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line
              x1="12"
              x2="652"
              y1={24 + t * 160}
              y2={24 + t * 160}
              stroke="var(--studio-grid)"
              strokeDasharray="4 5"
            />
            <text x="666" y={28 + t * 160} fill="var(--studio-muted)" fontSize="11">
              {number(max - t * range, 0)}
            </text>
          </g>
        ))}
        <path d={`${path(values)} L652,202 L12,202 Z`} fill={`url(#${id})`} />
        {comparison && <path d={path(comparison)} fill="none" stroke="#a4aab8" strokeWidth="2" strokeDasharray="5 5" />}
        <path
          d={path(values)}
          fill="none"
          stroke="#5967df"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1="12" y2="202" stroke="#9097b1" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(values[hover])} r="4" fill="#5967df" stroke="white" strokeWidth="2" />
          </>
        )}
      </svg>
      {labels && (
        <div className="chart-labels">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels.at(-1)}</span>
        </div>
      )}
    </div>
  );
}

export function MarketPanel() {
  const market = useMarket();
  const history = useMarketHistory();
  const [period, setPeriod] = useState(24);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const candles = history.data?.candles.slice(-period) ?? [];
  const fresh = market.data && now - Date.parse(market.data.retrievedAt) < 90_000 && !market.isError;
  return (
    <section className="card studio-card market-panel">
      <div className="section-head">
        <div className="eyebrow">MARKET REFERENCE</div>
        <span className={`badge status-badge ${fresh ? "live" : ""}`}>
          <span className="status-dot" />
          {fresh ? "Live reference" : market.data ? "Last known" : market.isPending ? "Connecting" : "Unavailable"}
        </span>
      </div>
      <div className="market-title">
        <Token symbol="WETH" />
        <span>
          Ethereum <small>ETH / USD</small>
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-sm refresh-market"
          aria-label="Refresh market price"
          disabled={market.isFetching}
          onClick={() => void market.refetch()}
        >
          <ArrowPathIcon className={`h-4 w-4 ${market.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="market-price">{market.data ? usd(market.data.price) : "—"}</div>
      <div className="market-subline">
        {market.data
          ? `${market.data.source} · ${market.data.source === "Coinbase" ? "Spot" : "Last-trade"} reference`
          : "Waiting for external price data"}
        <div className="tabs period-tabs" role="tablist" aria-label="Chart range">
          {[
            { label: "24H", hours: 24 },
            { label: "7D", hours: 168 },
            { label: "30D", hours: 720 },
          ].map(p => (
            <button
              key={p.hours}
              type="button"
              role="tab"
              aria-selected={period === p.hours}
              className={`tab ${period === p.hours ? "tab-active" : ""}`}
              onClick={() => setPeriod(p.hours)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {history.isError ? (
        <div className="chart-placeholder">
          History unavailable.{" "}
          <button className="btn btn-ghost btn-sm" onClick={() => void history.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <LineChart
          values={candles.map(c => c.close)}
          labels={candles.map(c =>
            new Date(c.time).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              hour12: false,
            }),
          )}
        />
      )}
      <div className="market-source">
        <span>Public market reference</span>
        <span>Chart: Kraken · Completed hourly candles</span>
      </div>
      {market.isError && (
        <p className="field-error" role="status">
          Price refresh failed. The last known value is not a current quote.
        </p>
      )}
      <Note>
        This is an external USD reference. Your pool sets swap prices from its reserves. USDX is an unbacked test token.
      </Note>
    </section>
  );
}

export function LearningCard() {
  return (
    <div className="card learning-card">
      <div className="learning-icon">
        <BeakerIcon className="h-5 w-5" />
      </div>
      <div>
        <h3>Understand before you trade.</h3>
        <p>Try the same constant-product mechanics with virtual balances.</p>
      </div>
      <Link href="/simulate" className="btn btn-sm btn-ghost">
        Open simulator <ArrowUpRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
