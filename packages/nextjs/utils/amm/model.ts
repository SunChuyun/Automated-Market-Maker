export type Candle = { time: number; close: number };
export type MarketQuote = { price: number; source: "Kraken" | "Coinbase"; retrievedAt: string };
export type MarketHistory = { candles: Candle[]; source: "Kraken"; retrievedAt: string };

export const EXAMPLE_POOL = { weth: 100, usdx: 250_000 };
export const BASE_FEE = 0.003;

// Illustrative floating-point math only. Contract quotes must use integer token units.
export function quoteSwap(amount: number, reserveIn: number, reserveOut: number, fee = BASE_FEE) {
  if (
    ![amount, reserveIn, reserveOut, fee].every(Number.isFinite) ||
    amount <= 0 ||
    reserveIn <= 0 ||
    reserveOut <= 0 ||
    fee < 0 ||
    fee >= 1
  )
    return null;
  const effective = amount * (1 - fee);
  const output = reserveOut * (effective / (reserveIn + effective));
  const impact = 1 - output / effective / (reserveOut / reserveIn);
  return { output, impact, fee: amount * fee };
}

export function impermanentLoss(priceRatio: number) {
  return priceRatio > 0 ? (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1 : 0;
}

// Orders execute at completed hourly closes; idle cash is included in portfolio value.
export function runDca(candles: Candle[], capital: number, intervalHours: number, fee = BASE_FEE) {
  if (candles.length < 2 || capital <= 0 || !Number.isFinite(capital) || intervalHours < 1) return null;
  const clean = candles.filter(c => Number.isFinite(c.close) && c.close > 0).toSorted((a, b) => a.time - b.time);
  if (clean.length < 2) return null;
  const orders = clean.filter((_, i) => i % intervalHours === 0);
  const allocation = capital / orders.length;
  let cash = capital;
  let units = 0;
  let nextOrder = 0;
  let peak = capital;
  let maxDrawdown = 0;
  const holdUnits = (capital * (1 - fee)) / clean[0].close;
  const trades: { time: number; price: number; amount: number; fee: number }[] = [];
  const points = clean.map(c => {
    if (orders[nextOrder]?.time === c.time) {
      const amount = (allocation * (1 - fee)) / c.close;
      units += amount;
      cash -= allocation;
      trades.push({ time: c.time, price: c.close, amount, fee: allocation * fee });
      nextOrder++;
    }
    const value = Math.max(0, cash) + units * c.close;
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, 1 - value / peak);
    return { time: c.time, value, hold: holdUnits * c.close };
  });
  const final = points.at(-1)!;
  return {
    points,
    trades,
    finalValue: final.value,
    returnPct: final.value / capital - 1,
    holdValue: final.hold,
    maxDrawdown,
    fees: capital * fee,
  };
}

export const number = (value: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
export const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
