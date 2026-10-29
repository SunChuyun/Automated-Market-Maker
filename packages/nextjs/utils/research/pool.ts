export type Observation = { time: number; price: number };
export type PoolConfig = {
  weth: number;
  usdx: number;
  capital: number;
  orderCap: number;
  poolFee: number;
  externalFee: number;
  slippage: number;
  gas: number;
  minProfit: number;
  minEdge: number;
};
export const DEMO_PRICES: Observation[] = Array.from({ length: 73 }, (_, i) => ({
  time: Date.UTC(2026, 0, 1) + i * 3600000,
  price: 2500 * (1 + Math.sin(i / 7) * 0.03 + i * 0.00025 + Math.sin(i / 2) * 0.003),
}));
export function parsePriceCsv(text: string): Observation[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 4 || lines.length > 5002)
    throw new Error("Use 3–5,000 observations with a timestamp,price header.");
  if (lines[0].trim().toLowerCase() !== "timestamp,price")
    throw new Error("CSV header must be timestamp,price. Use ISO UTC timestamps or Unix milliseconds/seconds.");
  const rows = lines
    .slice(1)
    .filter(s => s.trim())
    .map(line => {
      const fields = line.split(",");
      if (fields.length !== 2) throw new Error("Each CSV row needs exactly two fields.");
      const [t, p] = fields.map(s => s.trim());
      const raw = Number(t);
      const time = /^\d+$/.test(t) ? raw * (raw < 1e11 ? 1000 : 1) : Date.parse(t);
      const price = Number(p);
      if (
        !Number.isFinite(time) ||
        Math.abs(time) > 8.64e15 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        (!/^\d+$/.test(t) && !/(Z|[+-]\d\d:\d\d)$/.test(t))
      )
        throw new Error("Use positive prices and timestamps with an explicit timezone.");
      return { time, price };
    })
    .sort((a, b) => a.time - b.time);
  if (rows.length < 3 || rows.length > 5000 || rows.some((r, i) => i > 0 && r.time === rows[i - 1].time))
    throw new Error("Provide at least three distinct observation times.");
  return rows;
}
export function runPoolResearch(observations: Observation[], c: PoolConfig) {
  if (
    !Object.values(c).every(Number.isFinite) ||
    c.weth <= 0 ||
    c.usdx <= 0 ||
    c.capital <= 0 ||
    c.capital > 1e12 ||
    c.weth > 1e12 ||
    c.usdx > 1e12 ||
    c.orderCap <= 0 ||
    c.poolFee < 0.0005 ||
    c.poolFee > 0.05 ||
    c.externalFee < 0 ||
    c.externalFee > 0.05 ||
    c.slippage < 0 ||
    c.slippage > 0.05 ||
    c.gas < 0 ||
    c.minProfit < 0 ||
    c.minEdge < 0 ||
    c.minEdge > 0.5
  )
    throw new Error(
      "Check positive reserves/capital/order size, pool fee 0.05–5%, venue fee/slippage 0–5%, and nonnegative costs/thresholds.",
    );
  if (
    observations.length < 3 ||
    observations.length > 5000 ||
    observations.some(
      (p, i) =>
        !Number.isFinite(p.time) ||
        !Number.isFinite(p.price) ||
        p.price <= 0 ||
        p.price > 1e12 ||
        Math.abs(p.time) > 8.64e15 ||
        (i > 0 && p.time <= observations[i - 1].time),
    )
  )
    throw new Error("Provide 3–5,000 strictly ordered positive reference observations.");
  let weth = c.weth,
    usdx = c.usdx,
    cash = c.capital,
    peak = c.capital,
    maxDrawdown = 0,
    poolVolume = 0,
    lpFees = 0,
    protocolFees = 0;
  const trades: {
    time: number;
    direction: string;
    reference: number;
    before: number;
    after: number;
    input: number;
    weth: number;
    output: number;
    poolFee: number;
    externalFee: number;
    gas: number;
    impact: number;
    profit: number;
  }[] = [];
  const points = [{ time: observations[0].time, value: cash, strategy: 0, hold: 0, drawdown: 0 }];
  const first = observations[0].price;
  const holdUnits = (c.capital - c.gas) / (first * (1 + c.externalFee) * (1 + c.slippage));
  if (holdUnits <= 0) throw new Error("Starting capital must exceed one gas charge.");
  const holdLiquidated = holdUnits * observations.at(-1)!.price * (1 - c.externalFee) * (1 - c.slippage) >= c.gas;
  for (const [i, p] of observations.entries()) {
    const before = usdx / weth,
      cap = Math.max(0, Math.min(cash - c.gas, c.orderCap)),
      a = 1 - c.poolFee;
    const sellReference = p.price * (1 - c.externalFee) * (1 - c.slippage),
      buyReference = p.price * (1 + c.externalFee) * (1 + c.slippage);
    // Both round trips are fully funded by USDX cash. No borrowed assets or flash loans.
    const buySpend = Math.max(0, Math.min(cap, (Math.sqrt(sellReference * weth * a * usdx) - usdx) / a));
    const sellFactor = a / buyReference;
    const sellSpend = Math.max(0, Math.min(cap, (Math.sqrt(usdx * weth * sellFactor) - weth) / sellFactor));
    const buyQty = (weth * (a * buySpend)) / (usdx + a * buySpend),
      sellQty = sellSpend / buyReference;
    const buyProceeds = buyQty * sellReference,
      sellProceeds = (usdx * (a * sellQty)) / (weth + a * sellQty);
    const buyProfit = buyProceeds - buySpend - c.gas,
      sellProfit = sellProceeds - sellSpend - c.gas;
    if (Math.abs(before / p.price - 1) >= c.minEdge && Math.max(buyProfit, sellProfit) > c.minProfit) {
      const buy = buyProfit >= sellProfit,
        input = buy ? buySpend : sellSpend,
        quantity = buy ? buyQty : sellQty,
        output = buy ? buyProceeds : sellProceeds,
        profit = output - input - c.gas;
      // The 0.05% protocol portion is removed from LP reserves.
      const feeValue = (buy ? input : quantity * p.price) * c.poolFee;
      const impact = buy ? (a * input) / (usdx + a * input) : (a * quantity) / (weth + a * quantity);
      if (buy) {
        weth -= quantity;
        usdx += input * (1 - 0.0005);
      } else {
        weth += quantity * (1 - 0.0005);
        usdx -= output;
      }
      cash += profit;
      poolVolume += buy ? input : output;
      lpFees += (buy ? input : quantity * p.price) * (c.poolFee - 0.0005);
      protocolFees += (buy ? input : quantity * p.price) * 0.0005;
      const externalFee = buy
        ? quantity * p.price * (1 - c.slippage) * c.externalFee
        : quantity * p.price * (1 + c.slippage) * c.externalFee;
      trades.push({
        time: p.time,
        direction: buy ? "Buy in pool → sell at reference" : "Buy at reference → sell in pool",
        reference: p.price,
        before,
        after: usdx / weth,
        input,
        weth: quantity,
        output,
        poolFee: feeValue,
        externalFee,
        gas: c.gas,
        impact,
        profit,
      });
    }
    peak = Math.max(peak, cash);
    const drawdown = 1 - cash / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    const liquidate = i === observations.length - 1 && holdLiquidated;
    const holdValue =
      holdUnits * p.price * (liquidate ? (1 - c.externalFee) * (1 - c.slippage) : 1) - (liquidate ? c.gas : 0);
    points.push({
      time: p.time,
      value: cash,
      strategy: cash / c.capital - 1,
      hold: holdValue / c.capital - 1,
      drawdown,
    });
  }
  return {
    holdLiquidated,
    points,
    trades,
    finalValue: cash,
    profit: cash - c.capital,
    poolVolume,
    lpFees,
    protocolFees,
    maxDrawdown,
    weth,
    usdx,
  };
}
