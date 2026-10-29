"use client";
import { useState } from "react";
import { number } from "~~/utils/amm/model";

export function ReserveCurve({
  weth,
  usdx,
  nextWeth,
  nextUsdx,
}: {
  weth: number;
  usdx: number;
  nextWeth: number;
  nextUsdx: number;
}) {
  const maxX = Math.max(weth, nextWeth) * 2,
    maxY = Math.max(usdx, nextUsdx) * 2;
  const x = (v: number) => 64 + (v / maxX) * 560,
    y = (v: number) => 300 - (v / maxY) * 250;
  const path = (k: number) =>
    Array.from({ length: 180 }, (_, i) => {
      const start = k / maxY;
      const w = start + (i / 179) * (maxX - start);
      return `${i ? "L" : "M"}${x(w)},${y(k / w)}`;
    }).join(" ");
  return (
    <svg
      viewBox="0 0 700 355"
      className="research-chart"
      role="img"
      aria-label={`Reserve curve. Before ${number(weth)} WETH and ${number(usdx)} USDX. After ${number(nextWeth)} WETH and ${number(nextUsdx)} USDX.`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={t}>
          <line x1="64" x2="624" y1={y(t * maxY)} y2={y(t * maxY)} stroke="var(--studio-grid)" />
          <text x="54" y={y(t * maxY) + 4} textAnchor="end">
            {number(t * maxY, 0)}
          </text>
          <text x={x(t * maxX)} y="323" textAnchor="middle">
            {number(t * maxX, 1)}
          </text>
        </g>
      ))}
      <path d={path(weth * usdx)} fill="none" stroke="var(--studio-accent)" strokeWidth="3" />
      <path d={path(nextWeth * nextUsdx)} fill="none" stroke="#20a78b" strokeDasharray="5 5" strokeWidth="2" />
      <line x1={x(weth)} y1={y(usdx)} x2={x(nextWeth)} y2={y(nextUsdx)} stroke="#e89a3b" strokeWidth="3" />
      <circle cx={x(weth)} cy={y(usdx)} r="6" fill="var(--studio-accent)" />
      <circle cx={x(nextWeth)} cy={y(nextUsdx)} r="6" fill="#20a78b" />
      <text x={x(weth) + 12} y={y(usdx) + 22}>
        Before
      </text>
      <text x={x(nextWeth) - 12} y={y(nextUsdx) - 14} textAnchor="end">
        After
      </text>
      <text x="344" y="349" textAnchor="middle">
        WETH reserves
      </text>
      <text x="64" y="22">
        USDX reserves
      </text>
    </svg>
  );
}

export function ReturnChart({
  points,
  drawdown = false,
}: {
  points: { time: number; strategy: number; hold: number; drawdown: number }[];
  drawdown?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const series = points.map(p => (drawdown ? -p.drawdown * 100 : p.strategy * 100)),
    comparison = points.map(p => p.hold * 100);
  const all = drawdown ? [0, ...series] : [0, ...series, ...comparison];
  const lo = Math.min(...all),
    hi = Math.max(...all),
    span = hi - lo || 1;
  const x = (i: number) => 56 + (i / (points.length - 1)) * 832,
    y = (v: number) => 28 + ((hi - v) / span) * 240;
  const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <div>
      <div className="research-chart-readout">
        {hover === null
          ? "Move across the chart to inspect returns"
          : `${new Date(points[hover].time).toISOString().slice(0, 16).replace("T", " ")} UTC · Strategy ${number(series[hover])}%${drawdown ? "" : ` · Buy & hold ${number(comparison[hover])}%`}`}
      </div>
      <svg
        viewBox="0 0 960 310"
        role="img"
        aria-label={
          drawdown
            ? "Strategy drawdown"
            : "Cumulative strategy return compared with buy and hold, both starting at zero"
        }
        className="research-chart"
        onPointerMove={e => {
          const b = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(((((e.clientX - b.left) / b.width) * 960 - 56) / 832) * (points.length - 1)),
              ),
            ),
          );
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1="56" x2="888" y1={28 + t * 240} y2={28 + t * 240} stroke="var(--studio-grid)" />
            <text x="900" y={32 + t * 240}>
              {number(hi - t * span, 1)}%
            </text>
          </g>
        ))}
        <line x1="56" x2="888" y1={y(0)} y2={y(0)} stroke="var(--studio-muted)" strokeDasharray="3 5" />
        {!drawdown && <path d={path(comparison)} fill="none" stroke="#8d96a9" strokeWidth="2" />}
        <path d={path(series)} fill="none" stroke={drawdown ? "#d56f83" : "var(--studio-accent)"} strokeWidth="3" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1="24" y2="270" stroke="var(--studio-muted)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(series[hover])} r="5" fill="var(--studio-accent)" />
          </>
        )}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(i => (
          <text key={i} x={x(i)} y="298" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
            {new Date(points[i].time).toISOString().slice(0, 10)}
          </text>
        ))}
      </svg>
    </div>
  );
}
