export type CryptoAsset = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  rank: number;
  price: number;
  change1h: number | null;
  change24h: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  supply: number | null;
  maxSupply: number | null;
  sparkline: number[];
  updatedAt: string | null;
};
export type TokenMarkets = {
  assets: CryptoAsset[];
  nextCursor: string | null;
  retrievedAt: string;
  source: "CoinGecko";
  stale?: boolean;
};
export type ChartPoint = { time: number; value: number };
export type TokenChartData = { points: ChartPoint[]; retrievedAt: string; source: "CoinGecko"; stale?: boolean };
export type TokenAboutData = {
  excerpt: string;
  categories: string[];
  website: string | null;
  explorer: string | null;
  genesisDate: string | null;
  retrievedAt: string;
  stale?: boolean;
};
export const CHART_RANGES = ["1H", "1D", "1W", "1M", "1Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const instrumentIds = new Set([
  "tether-gold",
  "pax-gold",
  "kinesis-gold",
  "kinesis-silver",
  "janus-henderson-anemoy-treasury-fund",
  "blackrock-usd-institutional-digital-liquidity-fund",
  "ondo-us-dollar-yield",
  "ondo-short-term-us-government-bond-fund",
]);
export const isCryptoAsset = (id: string, name: string) =>
  !instrumentIds.has(id) &&
  !/\b(?:xstock|etf|tokenized stock|tokenized equity|tokenized gold|tokenized silver)\b/i.test(name);
export const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export const safeExternalUrl = (value: unknown): string | null => {
  try {
    const url = new URL(String(value));
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};
export const compactUsd = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value);
export const tokenPrice = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: value >= 1 ? 2 : 0,
        maximumFractionDigits: value >= 1 ? 2 : 8,
      }).format(value);
export const percentChange = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
export const feeApr = (dailyVolume: number, tvl: number, lpFee = 0.0025) =>
  tvl > 0 && dailyVolume >= 0 ? (dailyVolume * lpFee * 365) / tvl : null;
