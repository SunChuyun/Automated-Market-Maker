"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowPathIcon, ArrowUpIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { AssetIcon, Change, DataError, PoolMetrics, Sparkline } from "~~/components/explore/MarketUI";
import { useInfiniteTokenMarkets } from "~~/hooks/useExplore";
import { compactUsd, tokenPrice } from "~~/utils/explore/data";
import type { MarketOrder } from "~~/utils/explore/pagination";
import { type MarketSort, type SortDirection, compareAssets } from "~~/utils/explore/sort";

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MarketSort>("marketCap");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const order: MarketOrder = sort === "volume24h" ? `volume_${direction}` : "market_cap_desc";
  const markets = useInfiniteTokenMarkets(order);
  const sentinel = useRef<HTMLDivElement>(null);
  const locallySorted = sort !== "volume24h" && sort !== "marketCap";
  const assets = Array.from(
    new Map((markets.data?.pages.flatMap(page => page.assets) ?? []).map(asset => [asset.id, asset])).values(),
  ).filter(a => `${a.name} ${a.symbol}`.toLowerCase().includes(search.toLowerCase()));
  if (locallySorted) assets.sort((a, b) => compareAssets(a, b, sort, direction));

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, isFetching } = markets;
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching && !isFetchNextPageError && !search)
          void fetchNextPage({ cancelRefetch: false });
      },
      { rootMargin: "0px", threshold: 0.1 },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, search]);

  const selectSort = (field: MarketSort) => {
    setDirection(sort === field && direction === "desc" ? "asc" : "desc");
    setSort(field);
  };
  const sortHeader = (field: MarketSort, label: string, optional = false) => (
    <th
      className={optional ? "optional-col" : undefined}
      aria-sort={sort === field ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        className="market-sort-button"
        onClick={() => selectSort(field)}
        title={field === "volume24h" ? "Sort all markets by 24-hour volume" : "Sort loaded tokens"}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sort === field &&
          (direction === "desc" ? <ArrowDownIcon aria-hidden="true" /> : <ArrowUpIcon aria-hidden="true" />)}
      </button>
    </th>
  );

  return (
    <div className="studio-page explore-page">
      <PoolMetrics />
      <div className="market-toolbar tokens-toolbar">
        <h1>Tokens</h1>
        <div className="market-toolbar-actions">
          <label className="input market-search">
            <MagnifyingGlassIcon className="h-4 w-4" />
            <input
              aria-label="Search loaded tokens"
              value={search}
              placeholder="Search tokens"
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-circle"
            aria-label="Refresh tokens"
            disabled={markets.isFetching}
            onClick={() => void markets.refetch()}
          >
            <ArrowPathIcon className={`h-5 w-5 ${markets.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {locallySorted && (
        <p className="market-sort-scope" role="status">
          Sorting loaded tokens. Load more to expand the comparison.
        </p>
      )}
      {search && (
        <p className="market-sort-scope" role="status">
          Searching loaded tokens.
        </p>
      )}
      {(markets.isError || markets.data?.pages.some(page => page.stale)) && (
        <DataError
          message={
            markets.data
              ? "Showing the last available market snapshot. Refresh to reload the list."
              : "Market data is temporarily unavailable."
          }
          retry={() => void markets.refetch()}
        />
      )}
      <div className="token-table-wrap">
        <table className="table token-market-table">
          <thead>
            <tr>
              <th>
                <button
                  className="market-sort-button"
                  onClick={() => {
                    setSort("marketCap");
                    setDirection("desc");
                  }}
                  title="Reset to market-cap order"
                >
                  Token
                </button>
              </th>
              {sortHeader("price", "Price")}
              {sortHeader("change1h", "1H", true)}
              {sortHeader("change24h", "1D")}
              {sortHeader("fdv", "FDV", true)}
              {sortHeader("volume24h", "Volume (24H)", true)}
              <th className="spark-col">7D chart</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a.id}>
                <td>
                  <Link className="market-token-link" href={`/explore/${a.id}`}>
                    <AssetIcon asset={a} />
                    <span>
                      {a.name}
                      <small>{a.symbol}</small>
                    </span>
                  </Link>
                </td>
                <td className="price-cell">{tokenPrice(a.price)}</td>
                <td className="optional-col">
                  <Change value={a.change1h} />
                </td>
                <td>
                  <Change value={a.change24h} />
                </td>
                <td className="optional-col">{compactUsd(a.fdv)}</td>
                <td className="optional-col">{compactUsd(a.volume24h)}</td>
                <td className="spark-col">
                  <Sparkline values={a.sparkline} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {markets.isPending && (
          <div className="token-list-loading">
            <span className="loading loading-spinner" />
            Loading tokens…
          </div>
        )}
        {!markets.isPending && !markets.isError && !assets.length && (
          <div className="token-list-loading">No matching tokens in the loaded markets.</div>
        )}
      </div>
      <div ref={sentinel} className="list-sentinel">
        {isFetchingNextPage ? (
          <span className="loading loading-spinner" aria-label="Loading more tokens" />
        ) : hasNextPage ? (
          <button
            className="btn btn-ghost"
            disabled={isFetching}
            onClick={() => void fetchNextPage({ cancelRefetch: false })}
          >
            {isFetchNextPageError ? "Retry loading more tokens" : "Load more tokens"}
          </button>
        ) : markets.data ? (
          <span>All available markets loaded</span>
        ) : null}
      </div>
      <div className="market-attribution">
        <span>
          Market-wide prices and volumes ·{" "}
          <a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">
            Data by CoinGecko ↗
          </a>
        </span>
      </div>
    </div>
  );
}
