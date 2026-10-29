import { quoteSwap } from "./model";

export type PaperEvent = {
  id: string;
  time: number;
  action: string;
  weth: number;
  usdx: number;
  shares: number;
  feeUsdx: number;
};
export type PaperAccount = {
  weth: number;
  usdx: number;
  poolWeth: number;
  poolUsdx: number;
  totalShares: number;
  shares: number;
  events: PaperEvent[];
};
export const INITIAL_PAPER: PaperAccount = {
  weth: 1,
  usdx: 10000,
  poolWeth: 100,
  poolUsdx: 250000,
  totalShares: 100,
  shares: 0,
  events: [],
};

export function paperAction(
  a: PaperAccount,
  kind: "buy" | "sell" | "deposit" | "withdraw",
  amount: number,
  fee = 0.003,
): PaperAccount {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fee) || fee < 0.0005 || fee > 0.05)
    throw new Error("Enter a valid amount and fee.");
  let { weth, usdx, poolWeth, poolUsdx, totalShares, shares } = a;
  let dw = 0,
    du = 0,
    ds = 0,
    feeUsdx = 0;
  const spot = poolUsdx / poolWeth;
  if (kind === "buy" || kind === "sell") {
    const buy = kind === "buy";
    const q = quoteSwap(amount, buy ? poolUsdx : poolWeth, buy ? poolWeth : poolUsdx, fee)!;
    dw = buy ? q.output : -amount;
    du = buy ? -amount : q.output;
    feeUsdx = q.fee * (buy ? 1 : spot);
    // The protocol portion is separated from LP reserves, as proposed.
    poolWeth += buy ? -q.output : amount * (1 - 0.0005);
    poolUsdx += buy ? amount * (1 - 0.0005) : -q.output;
  } else if (kind === "deposit") {
    dw = -amount;
    du = -amount * spot;
    ds = (amount * totalShares) / poolWeth;
    poolWeth -= dw;
    poolUsdx -= du;
    totalShares += ds;
  } else {
    if (amount > shares) throw new Error("Insufficient paper LP shares.");
    ds = -amount;
    dw = (amount / totalShares) * poolWeth;
    du = (amount / totalShares) * poolUsdx;
    poolWeth -= dw;
    poolUsdx -= du;
    totalShares -= amount;
  }
  weth += dw;
  usdx += du;
  shares += ds;
  if (weth < -1e-9 || usdx < -1e-9) throw new Error("Insufficient paper assets.");
  const event = { id: crypto.randomUUID(), time: Date.now(), action: kind, weth: dw, usdx: du, shares: ds, feeUsdx };
  return {
    weth: Math.max(0, weth),
    usdx: Math.max(0, usdx),
    poolWeth,
    poolUsdx,
    totalShares,
    shares,
    events: [event, ...a.events].slice(0, 500),
  };
}

// Endpoint inventory of an idealized concentrated position. Fees and path-dependent time in range are excluded.
export function rangePosition(budget: number, initial: number, lower: number, upper: number, final: number) {
  if (
    ![budget, initial, lower, upper, final].every(Number.isFinite) ||
    budget <= 0 ||
    lower <= 0 ||
    final <= 0 ||
    !(lower < initial && initial < upper)
  )
    return null;
  const inventory = (p: number, l: number) => {
    const s = Math.sqrt(Math.min(upper, Math.max(lower, p)));
    return { weth: l * (1 / s - 1 / Math.sqrt(upper)), usdx: l * (s - Math.sqrt(lower)) };
  };
  const unit = inventory(initial, 1);
  const l = budget / (unit.weth * initial + unit.usdx);
  const start = inventory(initial, l),
    end = inventory(final, l);
  const hold = start.weth * final + start.usdx,
    value = end.weth * final + end.usdx;
  return { ...end, value, hold, relative: value / hold - 1, active: final > lower && final < upper, start };
}
