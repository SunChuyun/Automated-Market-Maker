import "server-only";
import type { MarketHistory, MarketQuote } from "~~/utils/amm/model";

let quoteCache: { data: MarketQuote; expires: number } | undefined;
let quoteInFlight: Promise<MarketQuote> | undefined;
let historyCache: { data: MarketHistory; expires: number } | undefined;
let historyInFlight: Promise<MarketHistory> | undefined;

async function request(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);
  return response.json();
}

async function fetchQuote(): Promise<MarketQuote> {
  let price: number;
  let source: MarketQuote["source"] = "Kraken";
  try {
    const data = await request("https://api.kraken.com/0/public/Ticker?pair=ETHUSD");
    if (data.error?.length) throw new Error("Kraken ticker unavailable");
    price = Number(data.result?.XETHZUSD?.c?.[0]);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price");
  } catch {
    source = "Coinbase";
    const data = await request("https://api.coinbase.com/v2/prices/ETH-USD/spot");
    price = Number(data.data?.amount);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid market price");
  return { price, source, retrievedAt: new Date().toISOString() };
}

export async function getMarketQuote() {
  if (quoteCache && quoteCache.expires > Date.now()) return quoteCache.data;
  quoteInFlight ??= fetchQuote()
    .then(data => {
      quoteCache = { data, expires: Date.now() + 20_000 };
      return data;
    })
    .finally(() => {
      quoteInFlight = undefined;
    });
  return quoteInFlight;
}

async function fetchHistory(): Promise<MarketHistory> {
  const data = await request("https://api.kraken.com/0/public/OHLC?pair=ETHUSD&interval=60");
  if (data.error?.length) throw new Error("Kraken history unavailable");
  const rows: unknown = data.result?.XETHZUSD;
  if (!Array.isArray(rows) || rows.length < 3) throw new Error("Invalid history");
  // Kraken's final candle is still open and must never enter a backtest.
  const candles = rows
    .slice(0, -1)
    .map(row => ({ time: (Number(row[0]) + 3600) * 1000, close: Number(row[4]) }))
    .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0);
  if (candles.length < 2 || candles.at(-1)!.time < Date.now() - 3 * 3_600_000)
    throw new Error("Historical data is stale");
  return { candles, source: "Kraken", retrievedAt: new Date().toISOString() };
}

export async function getMarketHistory() {
  if (historyCache && historyCache.expires > Date.now()) return historyCache.data;
  historyInFlight ??= fetchHistory()
    .then(data => {
      historyCache = { data, expires: Date.now() + 300_000 };
      return data;
    })
    .finally(() => {
      historyInFlight = undefined;
    });
  return historyInFlight;
}
