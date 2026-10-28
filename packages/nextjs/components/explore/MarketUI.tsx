"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { type ChartPoint, type CryptoAsset, percentChange, tokenPrice } from "~~/utils/explore/data";

export function AssetIcon({ asset, large = false }: { asset: Pick<CryptoAsset, "image" | "symbol">; large?: boolean }) {
  return (
    <span className={`asset-icon ${large ? "large" : ""}`}>
      {asset.image ? (
        <Image src={asset.image} alt="" width={large ? 44 : 34} height={large ? 44 : 34} unoptimized />
      ) : (
        asset.symbol.slice(0, 1)
      )}
    </span>
  );
}
export function Change({ value }: { value: number | null }) {
  return (
    <span className={`market-change ${value === null || value === 0 ? "" : value > 0 ? "up" : "down"}`}>
      {percentChange(value)}
    </span>
  );
}
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted">—</span>;
  const low = Math.min(...values),
    high = Math.max(...values),
    range = high - low || 1;
  const d = values
    .map((n, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * 110},${35 - ((n - low) / range) * 29}`)
    .join(" ");
  return (
    <svg className="token-sparkline" viewBox="0 0 112 40" role="img" aria-label="Seven day price trend">
      <path
        d={d}
        fill="none"
        stroke={values.at(-1)! >= values[0] ? "#2b9c78" : "#d35e75"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function PoolMetrics() {
  return (
    <section className="explore-pool-metrics" aria-label="Our pool statistics">
      <div className="pool-metrics-label">
        <span>Our pool · WETH / USDX</span>
        <span className="badge">On-chain data pending</span>
      </div>
      <div className="pool-metric-grid">
        {[
          { label: "24h pool volume", value: "—" },
          { label: "Pool liquidity", value: "—" },
          { label: "24h LP fees", value: "—" },
          { label: "Base swap fee", value: "0.30%" },
        ].map(m => (
          <div key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
export function DataError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="data-error" role="status">
      <span>{message}</span>
      <button type="button" className="btn btn-ghost" onClick={retry}>
        <ArrowPathIcon className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

export function PriceChart({
  points,
  symbol,
  onHover,
}: {
  points: ChartPoint[];
  symbol: string;
  onHover: (point: ChartPoint | null) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const id = useId().replaceAll(":", "");
  if (points.length < 2) return <div className="token-chart-empty">No chart data for this range.</div>;
  const min = Math.min(...points.map(p => p.value)),
    max = Math.max(...points.map(p => p.value));
  const spread = max - min || max * 0.01 || 1;
  const x = (i: number) => 16 + (i / (points.length - 1)) * 700;
  const y = (v: number) => 34 + ((max - v) / spread) * 255;
  const color = points.at(-1)!.value >= points[0].value ? "#4e69dd" : "#d35e75";
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const select = (i: number | null) => {
    setIndex(i);
    onHover(i === null ? null : points[i]);
  };
  const active = index === null ? null : points[Math.min(index, points.length - 1)];
  return (
    <div className="price-chart">
      <svg
        viewBox="0 0 800 330"
        role="img"
        aria-label={`${symbol} price chart. ${tokenPrice(points[0].value)} to ${tokenPrice(points.at(-1)!.value)}. Use arrow keys to inspect prices.`}
        tabIndex={0}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          select(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(((((e.clientX - r.left) / r.width) * 800 - 16) / 700) * (points.length - 1)),
              ),
            ),
          );
        }}
        onPointerLeave={() => select(null)}
        onBlur={() => select(null)}
        onKeyDown={e => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            select(Math.max(0, Math.min(points.length - 1, (index ?? 0) + (e.key === "ArrowRight" ? 1 : -1))));
          }
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor={color} stopOpacity=".12" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line
              x1="16"
              x2="716"
              y1={34 + t * 255}
              y2={34 + t * 255}
              stroke="var(--studio-grid)"
              strokeDasharray="3 6"
            />
            <text x="733" y={38 + t * 255} fontSize="12" fill="var(--studio-muted)">
              {tokenPrice(max - t * spread)}
            </text>
          </g>
        ))}
        <path d={`${d} L716,309 L16,309 Z`} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
        {active && index !== null && (
          <>
            <line
              x1={x(Math.min(index, points.length - 1))}
              x2={x(Math.min(index, points.length - 1))}
              y1="18"
              y2="310"
              stroke="#a4abbd"
              strokeDasharray="3 4"
            />
            <circle
              cx={x(Math.min(index, points.length - 1))}
              cy={y(active.value)}
              r="5"
              fill={color}
              stroke="white"
              strokeWidth="2.5"
            />
          </>
        )}
      </svg>
      <div className="price-chart-dates">
        {[points[0], points[Math.floor(points.length / 2)], points.at(-1)!].map(p => (
          <span key={p.time}>
            {new Date(p.time).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
