import "server-only";
import {
  type ChartPoint,
  type ChartRange,
  type CryptoAsset,
  type TokenAboutData,
  type TokenChartData,
  type TokenMarkets,
  finiteNumber,
  isCryptoAsset,
  safeExternalUrl,
} from "~~/utils/explore/data";

type Cached = { value: { retrievedAt: string }; expires: number };
const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<unknown>>();
async function cached<T extends { retrievedAt: string }>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T & { stale?: boolean }> {
  const previous = cache.get(key) as { value: T; expires: number } | undefined;
  if (previous && previous.expires > Date.now()) return previous.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const operation = fetcher()
    .then(value => {
      if (cache.size > 150) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .catch(error => {
      if (previous && Date.now() - Date.parse(previous.value.retrievedAt) < 30 * 60_000)
        return { ...previous.value, stale: true };
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, operation);
  return operation;
}
async function request(path: string) {
  const key = process.env.COINGECKO_DEMO_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["x-cg-demo-api-key"] = key;
  const response = await fetch(`https://api.coingecko.com/api/v3/${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers,
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);
  return response.json();
}
function normalizeAsset(row: any): CryptoAsset {
  const logo = safeExternalUrl(row.image);
  return {
    id: row.id,
    name: row.name,
    symbol: String(row.symbol).toUpperCase(),
    rank: row.market_cap_rank ?? 0,
    image: logo && ["coin-images.coingecko.com", "assets.coingecko.com"].includes(new URL(logo).hostname) ? logo : "",
    price: row.current_price,
    change1h: finiteNumber(row.price_change_percentage_1h_in_currency),
    change24h: finiteNumber(row.price_change_percentage_24h),
    marketCap: finiteNumber(row.market_cap),
    fdv: finiteNumber(row.fully_diluted_valuation),
    volume24h: finiteNumber(row.total_volume),
    high24h: finiteNumber(row.high_24h),
    low24h: finiteNumber(row.low_24h),
    supply: finiteNumber(row.circulating_supply),
    maxSupply: finiteNumber(row.max_supply),
    sparkline: Array.isArray(row.sparkline_in_7d?.price)
      ? row.sparkline_in_7d.price.filter((n: unknown) => finiteNumber(n) !== null)
      : [],
    updatedAt: typeof row.last_updated === "string" ? row.last_updated : null,
  };
}

const assetCache = new Map<string, { asset: CryptoAsset; expires: number }>();
async function marketBatch(page: number) {
  const result = await cached(`markets:${page}`, 60_000, async () => {
    const rows = await request(
      `coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d`,
    );
    if (!Array.isArray(rows)) throw new Error("Invalid market list");
    return {
      assets: rows
        .filter(
          r =>
            typeof r.id === "string" &&
            typeof r.name === "string" &&
            finiteNumber(r.current_price) !== null &&
            isCryptoAsset(r.id, r.name),
        )
        .map(normalizeAsset),
      complete: rows.length < 250,
      retrievedAt: new Date().toISOString(),
    };
  });
  result.assets.forEach(asset => assetCache.set(asset.id, { asset, expires: Date.parse(result.retrievedAt) + 60_000 }));
  return result;
}
export async function getTokenMarkets(cursor = "1:0"): Promise<TokenMarkets> {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(cursor);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 500 || Number(match[2]) > 250)
    throw new RangeError("Invalid market cursor");
  let page = Number(match[1]),
    offset = Number(match[2]);
  const assets: CryptoAsset[] = [];
  let done = false,
    stale = false,
    retrievedAt = "";
  for (let attempt = 0; attempt < 3 && assets.length < 100 && !done; attempt++) {
    const batch = await marketBatch(page);
    retrievedAt = batch.retrievedAt;
    stale ||= Boolean(batch.stale);
    const take = batch.assets.slice(offset, offset + 100 - assets.length);
    assets.push(...take);
    offset += take.length;
    if (offset >= batch.assets.length) {
      done = batch.complete;
      if (!done) {
        page++;
        offset = 0;
      }
    }
  }
  return { assets, source: "CoinGecko", retrievedAt, stale, nextCursor: done ? null : `${page}:${offset}` };
}
export async function getKnownAsset(id: string): Promise<CryptoAsset | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return null;
  const known = assetCache.get(id);
  if (known && known.expires > Date.now()) return known.asset;
  try {
    const result = await cached(`asset:${id}`, 60_000, async () => {
      const data = await request(
        `coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`,
      );
      const m = data.market_data;
      if (!m || finiteNumber(m.current_price?.usd) === null || !isCryptoAsset(id, data.name))
        throw new Error("Market provider returned 404");
      return {
        asset: normalizeAsset({
          ...data,
          image: data.image?.small,
          current_price: m.current_price?.usd,
          market_cap: m.market_cap?.usd,
          fully_diluted_valuation: m.fully_diluted_valuation?.usd,
          total_volume: m.total_volume?.usd,
          high_24h: m.high_24h?.usd,
          low_24h: m.low_24h?.usd,
          circulating_supply: m.circulating_supply,
          max_supply: m.max_supply,
          price_change_percentage_1h_in_currency: m.price_change_percentage_1h_in_currency?.usd,
          price_change_percentage_24h: m.price_change_percentage_24h,
          sparkline_in_7d: m.sparkline_7d,
        }),
        retrievedAt: new Date().toISOString(),
      };
    });
    return result.asset;
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("404")) return null;
    throw error;
  }
}
export async function getTokenChart(id: string, range: ChartRange): Promise<TokenChartData> {
  const days = range === "1H" || range === "1D" ? 1 : range === "1W" ? 7 : range === "1M" ? 30 : 365;
  const chart = await cached(`chart:${id}:${days}`, 300_000, async () => {
    const data = await request(`coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`);
    if (!Array.isArray(data.prices)) throw new Error("Invalid chart data");
    const points: ChartPoint[] = data.prices
      .filter((r: unknown) => Array.isArray(r) && finiteNumber(r[0]) !== null && finiteNumber(r[1]) !== null)
      .map((r: number[]) => ({ time: r[0], value: r[1] }));
    if (points.length < 2) throw new Error("Chart data unavailable");
    return { points, source: "CoinGecko" as const, retrievedAt: new Date().toISOString() };
  });
  const end = chart.points.at(-1)!.time;
  return { ...chart, points: range === "1H" ? chart.points.filter(p => p.time >= end - 3_600_000) : chart.points };
}
export async function getTokenAbout(id: string): Promise<TokenAboutData> {
  return cached(`about:${id}`, 86_400_000, async () => {
    const data = await request(
      `coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
    );
    const text = String(data.description?.en ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .trim();
    const words = text.split(/\s+/).filter(Boolean);
    return {
      excerpt: words.slice(0, 22).join(" ") + (words.length > 22 ? "…" : ""),
      categories: Array.isArray(data.categories)
        ? data.categories.filter((s: unknown) => typeof s === "string").slice(0, 3)
        : [],
      website: safeExternalUrl(data.links?.homepage?.find((s: string) => s)),
      explorer: safeExternalUrl(data.links?.blockchain_site?.find((s: string) => s)),
      genesisDate: data.genesis_date || null,
      retrievedAt: new Date().toISOString(),
    };
  });
}
