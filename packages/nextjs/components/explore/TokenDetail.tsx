"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { AssetIcon, Change, DataError, PriceChart } from "~~/components/explore/MarketUI";
import { useTokenAbout, useTokenAsset, useTokenChart } from "~~/hooks/useExplore";
import {
  CHART_RANGES,
  type ChartPoint,
  type ChartRange,
  type CryptoAsset,
  compactUsd,
  tokenPrice,
} from "~~/utils/explore/data";

export function TokenDetail({ id }: { id: string }) {
  const markets = useTokenAsset(id);
  const asset = markets.data?.asset;
  if (markets.isPending)
    return (
      <div className="studio-page">
        <div className="token-list-loading">
          <span className="loading loading-spinner" />
          Loading token…
        </div>
      </div>
    );
  if (!asset)
    return (
      <div className="studio-page">
        <Link href="/explore" className="token-back">
          <ArrowLeftIcon className="h-4 w-4" />
          Explore
        </Link>
        <h1 className="simple-title">{markets.isError ? "Market data unavailable" : "Token not found"}</h1>
        <DataError
          message={markets.isError ? "Please retry the market request." : "This token is unavailable."}
          retry={() => void markets.refetch()}
        />
      </div>
    );
  return <LoadedTokenDetail key={asset.id} asset={asset} delayed={markets.isError || false} />;
}
function LoadedTokenDetail({ asset, delayed }: { asset: CryptoAsset; delayed: boolean }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const chart = useTokenChart(asset.id, range);
  const about = useTokenAbout(asset.id);
  const points = chart.data?.points ?? [];
  const change = points.length > 1 ? ((hover?.value ?? points.at(-1)!.value) / points[0].value - 1) * 100 : null;
  return (
    <div className="studio-page token-detail-page">
      <Link href="/explore" className="token-back">
        <ArrowLeftIcon className="h-4 w-4" />
        Explore
      </Link>
      <div className="token-detail-layout">
        <div className="token-main">
          <div className="token-name-row">
            <AssetIcon asset={asset} large />
            <h1>
              {asset.name} <span>{asset.symbol}</span>
            </h1>
            <span className="badge">Crypto</span>
          </div>
          <div className="token-big-price">{tokenPrice(hover?.value ?? asset.price)}</div>
          <div className="token-price-context">
            <Change value={change} />
            <span>{hover ? new Date(hover.time).toLocaleString("en-US") : `${range} · Market reference`}</span>
            {(delayed || chart.data?.stale || chart.isError) && <span className="badge">Delayed data</span>}
          </div>
          {chart.isPending ? (
            <div className="token-chart-empty">
              <span className="loading loading-spinner" />
              Loading chart…
            </div>
          ) : chart.isError && !chart.data ? (
            <DataError message="Chart data is temporarily unavailable." retry={() => void chart.refetch()} />
          ) : (
            <PriceChart key={range} points={points} symbol={asset.symbol} onHover={setHover} />
          )}
          <div className="token-chart-toolbar">
            <div className="tabs chart-range-tabs" role="tablist" aria-label="Price chart range">
              {CHART_RANGES.map(r => (
                <button
                  className={`tab ${range === r ? "tab-active" : ""}`}
                  role="tab"
                  aria-selected={range === r}
                  key={r}
                  onClick={() => {
                    setRange(r);
                    setHover(null);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <a href={`https://www.coingecko.com/en/coins/${asset.id}`} target="_blank" rel="noreferrer">
              CoinGecko ↗
            </a>
          </div>
          <section className="token-stat-section">
            <h2>Market stats</h2>
            <div className="token-stat-grid">
              {[
                { label: "Market cap", value: compactUsd(asset.marketCap) },
                { label: "24h volume", value: compactUsd(asset.volume24h) },
                { label: "Fully diluted valuation", value: compactUsd(asset.fdv) },
                { label: "24h low", value: tokenPrice(asset.low24h) },
                { label: "24h high", value: tokenPrice(asset.high24h) },
                {
                  label: "Circulating supply",
                  value:
                    asset.supply === null
                      ? "—"
                      : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(
                          asset.supply,
                        ) +
                        " " +
                        asset.symbol,
                },
              ].map(s => (
                <div key={s.label}>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="token-about">
            <h2>About {asset.name}</h2>
            {about.data?.excerpt && <p>{about.data.excerpt}</p>}
            <div className="token-categories">
              {about.data?.categories.map(c => (
                <span className="badge" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <div className="about-resource-links">
              {about.data?.website && (
                <a className="btn btn-ghost" href={about.data.website} target="_blank" rel="noreferrer">
                  Website <ArrowUpRightIcon className="h-4 w-4" />
                </a>
              )}
              {about.data?.explorer && (
                <a className="btn btn-ghost" href={about.data.explorer} target="_blank" rel="noreferrer">
                  Explorer <ArrowUpRightIcon className="h-4 w-4" />
                </a>
              )}
              <a
                className="btn btn-ghost"
                href={`https://www.coingecko.com/en/coins/${asset.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Read more on CoinGecko <ArrowUpRightIcon className="h-4 w-4" />
              </a>
            </div>
            {about.isError && <p className="muted">Additional token information is unavailable.</p>}
          </section>
        </div>
        <TradePanel asset={asset} delayed={delayed} />
      </div>
    </div>
  );
}
function TradePanel({ asset, delayed }: { asset: CryptoAsset; delayed: boolean }) {
  const [tab, setTab] = useState("swap");
  const [amount, setAmount] = useState("100");
  const [limit, setLimit] = useState(String(asset.price));
  const [expiry, setExpiry] = useState("7");
  const sell = tab === "sell";
  const price = tab === "limit" ? Number(limit) : asset.price;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && Number.isFinite(price) && price > 0;
  const estimate = valid ? (sell ? value * price : value / price) : null;
  const supported = asset.id === "ethereum";
  return (
    <aside className="card token-trade-panel">
      <div className="tabs trade-panel-tabs" role="tablist" aria-label="Trade action">
        {[
          { id: "swap", label: "Swap" },
          { id: "limit", label: "Limit buy" },
          { id: "sell", label: "Sell" },
        ].map(t => (
          <button
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => {
              setTab(t.id);
              setAmount(t.id === "sell" ? "0.1" : "100");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="detail-trade-field">
        <label htmlFor="token-trade-amount">{sell ? `Sell ${asset.symbol}` : "You pay"}</label>
        <div>
          <input
            className="input"
            id="token-trade-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <span>{sell ? asset.symbol : "USDX"}</span>
        </div>
      </div>
      {tab === "limit" && (
        <>
          <label className="trade-field-label" htmlFor="limit-price">
            Buy when price reaches
          </label>
          <div className="unit-input">
            <input
              className="input"
              id="limit-price"
              type="number"
              min="0"
              step="any"
              value={limit}
              onChange={e => setLimit(e.target.value)}
            />
            <span>USD</span>
          </div>
        </>
      )}
      <div className="detail-trade-arrow">
        <ArrowDownIcon className="h-4 w-4" />
      </div>
      <div className="detail-trade-field">
        <label>Reference amount</label>
        <div>
          <output>
            {estimate === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(estimate)}
          </output>
          <span>{sell ? "USDX" : asset.symbol}</span>
        </div>
      </div>
      {tab === "limit" && (
        <label className="limit-expiry">
          Expires in
          <select
            className="select"
            aria-label="Limit order expiry"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
      )}
      {tab === "limit" ? (
        <button className="btn btn-primary primary-action" disabled>
          Limit orders coming soon
        </button>
      ) : supported && valid && !delayed ? (
        <Link className="btn btn-primary primary-action" href="/">
          Open WETH / USDX swap
        </Link>
      ) : (
        <button className="btn btn-primary primary-action" disabled>
          {supported ? "Quote unavailable" : `${asset.symbol} trading unavailable`}
        </button>
      )}
      <p className="trade-availability">
        {tab === "limit"
          ? "Order execution is not connected."
          : supported
            ? "Trade WETH in the project's test pool."
            : "This pool supports WETH / USDX only."}
      </p>
      <details className="trade-disclosure">
        <summary>About this preview</summary>
        <p>
          Reference conversion only, assuming 1 USDX = 1 USD. No fees or gas included. USDX is an unbacked test token.
          No order is submitted from this panel.
        </p>
      </details>
    </aside>
  );
}
