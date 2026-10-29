import type { Bar } from "~~/utils/research/engine";

export const maxDuration = 60;
const cache = new Map<string, { expires: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const steps: Record<string, number> = { "1m": 60, "5m": 300, "1h": 3600, "1d": 86400, "1M": 86400 };
async function load(start: number, end: number, frequency: string) {
  const step = steps[frequency],
    rows = new Map<number, Bar>();
  // Requests stay below Coinbase's 300-candle ceiling. Warm-up data is included in the same bounded budget.
  for (let from = start; from < end; from += step * 280000) {
    const to = Math.min(end, from + step * 280000);
    const url = new URL("https://api.exchange.coinbase.com/products/ETH-USD/candles");
    url.search = new URLSearchParams({
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      granularity: String(step),
    }).toString();
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Historical provider returned ${res.status}. Try a shorter window or retry later.`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid candle response.");
    for (const r of data) {
      if (!Array.isArray(r) || r.length < 6) continue;
      const [t, low, high, open, close, volume] = r.map(Number);
      const time = t * 1000;
      if (time < start || time + step * 1000 > end || time + step * 1000 > Date.now()) continue;
      if (
        ![time, low, high, open, close, volume].every(Number.isFinite) ||
        Math.min(open, high, low, close) <= 0 ||
        volume < 0
      )
        throw new Error("Invalid OHLCV data.");
      rows.set(time, { time, end: time + step * 1000, open, high, low, close, volume });
    }
  }
  let bars = [...rows.values()].sort((a, b) => a.time - b.time);
  if (bars.length < 3) throw new Error("No completed candles are available for this window.");
  let gaps = 0;
  for (let i = 1; i < bars.length; i++) if (bars[i].time - bars[i - 1].time !== step * 1000) gaps++;
  if (frequency === "1M") {
    const groups = new Map<string, Bar[]>();
    for (const b of bars) {
      const key = new Date(b.time).toISOString().slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }
    bars = [...groups.values()].flatMap(g => {
      const d = new Date(g[0].time),
        begin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
        finish = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      if (g[0].time !== begin || g.at(-1)!.end !== finish || g.length !== (finish - begin) / 86400000) return [];
      return [
        {
          time: begin,
          end: finish,
          open: g[0].open,
          close: g.at(-1)!.close,
          high: Math.max(...g.map(b => b.high)),
          low: Math.min(...g.map(b => b.low)),
          volume: g.reduce((s, b) => s + b.volume, 0),
        },
      ];
    });
  }
  return { bars, gaps, source: "Coinbase Exchange ETH/USD", frequency };
}
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    frequency = p.get("frequency") ?? "1d",
    start = Date.parse(p.get("start") ?? ""),
    end = Date.parse(p.get("end") ?? "");
  if (
    !Object.hasOwn(steps, frequency) ||
    ![start, end].every(Number.isFinite) ||
    start >= end ||
    end > Date.now() ||
    start < Date.UTC(2016, 0, 1)
  )
    return Response.json({ error: "Select a valid completed date range, starting in 2016 or later." }, { status: 400 });
  if ((end - start) / (steps[frequency] * 1000) > 6000)
    return Response.json(
      {
        error:
          "Limit each request to 6,000 source candles, including indicator warm-up. Shorten the date range or use a coarser frequency.",
      },
      { status: 400 },
    );
  const key = `${start}:${end}:${frequency}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json(cached.data);
  try {
    if (!inflight.has(key))
      inflight.set(
        key,
        load(start, end, frequency)
          .then(data => {
            if (cache.size >= 20) cache.delete(cache.keys().next().value!);
            cache.set(key, { expires: Date.now() + 300000, data });
            return data;
          })
          .finally(() => inflight.delete(key)),
      );
    return Response.json(await inflight.get(key), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
