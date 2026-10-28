"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { AssetIcon, Change, DataError, PoolMetrics, Sparkline } from "~~/components/explore/MarketUI";
import { useInfiniteTokenMarkets } from "~~/hooks/useExplore";
import { compactUsd, tokenPrice } from "~~/utils/explore/data";

export default function ExplorePage() {
  const markets = useInfiniteTokenMarkets();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("cap");

  const sentinel = useRef<HTMLDivElement>(null);
  const assets = Array.from(
    new Map((markets.data?.pages.flatMap(page => page.assets) ?? []).map(asset => [asset.id, asset])).values(),
  )
    .filter(a => `${a.name} ${a.symbol}`.toLowerCase().includes(search.toLowerCase()))
    .toSorted((a, b) =>
      sort === "volume"
        ? (b.volume24h ?? -1) - (a.volume24h ?? -1)
        : sort === "change"
          ? (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)
          : (b.marketCap ?? -1) - (a.marketCap ?? -1),
    );
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, isFetching } = markets;
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching && !isFetchNextPageError && !search)
          void fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, search]);

  return (
    <div className="studio-page explore-page">
      <PoolMetrics />
      <div className="explore-title-row">
        <div>
          <h1>Explore crypto</h1>
          <p>Discover the market. Find your next perspective.</p>
        </div>
        <Link href="/earn" className="btn explore-earn-link">
          Earn with WETH / USDX ↗
        </Link>
      </div>
      <div className="market-toolbar">
        <span className="crypto-filter">
          Cryptocurrencies <span>{assets.length ?? "—"}</span>
        </span>
        <div className="market-toolbar-actions">
          <label className="input market-search">
            <MagnifyingGlassIcon className="h-4 w-4" />
            <input
              aria-label="Search cryptocurrencies"
              value={search}
              placeholder="Search tokens"
              onChange={e => {
                setSearch(e.target.value);
              }}
            />
          </label>
          <select
            className="select sort-select"
            aria-label="Sort tokens"
            value={sort}
            onChange={e => {
              setSort(e.target.value);
            }}
          >
            <option value="cap">Market cap</option>
            <option value="volume">24h volume</option>
            <option value="change">Top gainers</option>
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-circle"
            aria-label="Refresh cryptocurrencies"
            disabled={markets.isFetching}
            onClick={() => void markets.refetch()}
          >
            <ArrowPathIcon className={`h-5 w-5 ${markets.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {(markets.isError || markets.data?.pages.some(page => page.stale)) && (
        <DataError
          message={
            markets.data
              ? "Showing the last available market snapshot. Refresh is delayed."
              : "Market data is temporarily unavailable."
          }
          retry={() => void markets.refetch()}
        />
      )}
      <div className="token-table-wrap">
        <table className="table token-market-table">
          <thead>
            <tr>
              <th className="rank-col">#</th>
              <th>Token</th>
              <th>Price</th>
              <th className="optional-col">1H</th>
              <th>1D</th>
              <th className="optional-col">FDV</th>
              <th className="optional-col">24h volume</th>
              <th className="spark-col">7D chart</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a.id}>
                <td className="rank-col">{a.rank}</td>
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
            Loading cryptocurrency markets…
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
          <button className="btn btn-ghost" onClick={() => void fetchNextPage()}>
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
