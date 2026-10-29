export type Bar = { time: number; end: number; open: number; high: number; low: number; close: number; volume: number };
export type Strategy = { id: string; name: string; entry: string; exit: string; description: string };
export const STRATEGIES: Strategy[] = [
  {
    id: "sma",
    name: "SMA crossover",
    entry: "crossAbove(sma(10), sma(30))",
    exit: "crossBelow(sma(10), sma(30))",
    description: "Buy a bullish moving-average cross; exit on a bearish cross.",
  },
  {
    id: "ema",
    name: "EMA crossover",
    entry: "crossAbove(ema(10), ema(30))",
    exit: "crossBelow(ema(10), ema(30))",
    description: "Trend following with more weight on recent prices.",
  },
  {
    id: "rsi",
    name: "RSI mean reversion",
    entry: "rsi(14) < 30",
    exit: "rsi(14) > 70",
    description: "Buy oversold conditions; exit when RSI becomes overbought.",
  },
  {
    id: "bollinger",
    name: "Bollinger breakout",
    entry: "crossAbove(close, upper(20, 2))",
    exit: "close < sma(20)",
    description: "Buy an upper-band breakout; exit below the middle band.",
  },
  {
    id: "macd",
    name: "MACD crossover",
    entry: "crossAbove(macd(12, 26), signal(12, 26, 9))",
    exit: "crossBelow(macd(12, 26), signal(12, 26, 9))",
    description: "Trade MACD line crosses against its signal line.",
  },
];
type Ast =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "call"; name: string; args: Ast[] }
  | { type: "binary"; op: string; left: Ast; right: Ast }
  | { type: "unary"; op: string; value: Ast };
const arities: Record<string, number> = {
  sma: 1,
  ema: 1,
  rsi: 1,
  upper: 2,
  lower: 2,
  macd: 2,
  signal: 3,
  crossAbove: 2,
  crossBelow: 2,
};
export function parseExpression(source: string): Ast {
  if (source.length > 1000) throw new Error("Keep each expression within 1,000 characters.");
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_]+|&&|\|\||>=|<=|==|!=|[()+\-*/!,<>]/g) ?? [];
  if (tokens.join("") !== source.replace(/\s/g, "") || tokens.length > 250)
    throw new Error("Use indicator expressions only. Imports, assignments and arbitrary code are unsupported.");
  let pos = 0,
    depth = 0;
  const precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    ">": 4,
    "<": 4,
    ">=": 4,
    "<=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
  };
  const parse = (min = 0): Ast => {
    if (++depth > 24) throw new Error("Expression nesting is too deep.");
    const token = tokens[pos++];
    let left: Ast;
    if (token === "!" || token === "-") left = { type: "unary", op: token, value: parse(7) };
    else if (token === "(") {
      left = parse();
      if (tokens[pos++] !== ")") throw new Error("Missing closing parenthesis.");
    } else if (/^\d/.test(token ?? "")) left = { type: "number", value: Number(token) };
    else if (token && tokens[pos] === "(") {
      if (!Object.hasOwn(arities, token)) throw new Error(`Unknown indicator: ${token}`);
      pos++;
      const args: Ast[] = [];
      if (tokens[pos] !== ")") {
        do {
          args.push(parse());
          if (tokens[pos] !== ",") break;
          pos++;
        } while (pos < tokens.length);
      }
      if (tokens[pos++] !== ")" || args.length !== arities[token]) throw new Error(`Check the arguments for ${token}.`);
      if (!token.startsWith("cross"))
        args.forEach((a, i) => {
          if (
            a.type !== "number" ||
            a.value <= 0 ||
            a.value > 200 ||
            ((i !== 1 || !["upper", "lower"].includes(token)) && !Number.isInteger(a.value))
          )
            throw new Error("Indicator arguments must be positive constants up to 200; periods must be integers.");
        });
      left = { type: "call", name: token, args };
    } else if (["close", "open", "high", "low", "volume"].includes(token)) left = { type: "variable", name: token };
    else throw new Error(`Unexpected expression token: ${token ?? "end"}`);
    while ((precedence[tokens[pos]] ?? -1) >= min) {
      const op = tokens[pos++];
      left = { type: "binary", op, left, right: parse(precedence[op] + 1) };
    }
    depth--;
    return left;
  };
  const result = parse();
  if (pos !== tokens.length) throw new Error("Unexpected text after the expression.");
  return result;
}

function ema(values: number[], period: number) {
  let count = 0,
    sum = 0,
    last = NaN;
  return values.map(v => {
    if (!Number.isFinite(v)) return NaN;
    if (count < period) {
      sum += v;
      count++;
      if (count === period) last = sum / period;
    } else last = (v * 2) / (period + 1) + last * (1 - 2 / (period + 1));
    return last;
  });
}
export function evaluator(bars: Bar[]) {
  const cache = new Map<string, number[]>(),
    closes = bars.map(b => b.close);
  const indicator = (name: string, args: number[]) => {
    const key = `${name}:${args}`;
    if (cache.has(key)) return cache.get(key)!;
    const [n, k] = args;
    let result: number[];
    if (name === "ema") result = ema(closes, n);
    else if (name === "macd") {
      const fast = indicator("ema", [n]),
        slow = indicator("ema", [k]);
      result = fast.map((v, i) => v - slow[i]);
    } else if (name === "signal") result = ema(indicator("macd", [n, k]), args[2]);
    else if (name === "rsi") {
      let gains = 0,
        losses = 0;
      result = closes.map((v, i) => {
        if (i === 0) return NaN;
        const d = v - closes[i - 1];
        if (i <= n) {
          gains += Math.max(0, d) / n;
          losses += Math.max(0, -d) / n;
        } else {
          gains = (gains * (n - 1) + Math.max(0, d)) / n;
          losses = (losses * (n - 1) + Math.max(0, -d)) / n;
        }
        return i < n ? NaN : losses === 0 ? (gains === 0 ? 50 : 100) : 100 - 100 / (1 + gains / losses);
      });
    } else
      result = closes.map((_, i) => {
        if (i < n - 1) return NaN;
        const window = closes.slice(i - n + 1, i + 1),
          mean = window.reduce((a, b) => a + b, 0) / n;
        if (name === "sma") return mean;
        const std = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
        return mean + (name === "upper" ? 1 : -1) * k * std;
      });
    cache.set(key, result);
    return result;
  };
  const evaluate = (node: Ast, i: number): number => {
    if (i < 0) return NaN;
    if (node.type === "number") return node.value;
    if (node.type === "variable") return bars[i][node.name as keyof Bar];
    if (node.type === "unary") {
      const v = evaluate(node.value, i);
      return Number.isFinite(v) ? (node.op === "!" ? +!v : -v) : NaN;
    }
    if (node.type === "call") {
      if (node.name.startsWith("cross")) {
        const [a, b] = node.args;
        const x = evaluate(a, i),
          y = evaluate(b, i),
          px = evaluate(a, i - 1),
          py = evaluate(b, i - 1);
        return [x, y, px, py].every(Number.isFinite)
          ? +(node.name === "crossAbove" ? x > y && px <= py : x < y && px >= py)
          : NaN;
      }
      return indicator(
        node.name,
        node.args.map(a => (a as { value: number }).value),
      )[i];
    }
    const a = evaluate(node.left, i),
      b = evaluate(node.right, i);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    switch (node.op) {
      case ">":
        return +(a > b);
      case "<":
        return +(a < b);
      case ">=":
        return +(a >= b);
      case "<=":
        return +(a <= b);
      case "==":
        return +(a === b);
      case "!=":
        return +(a !== b);
      case "&&":
        return +(!!a && !!b);
      case "||":
        return +(!!a || !!b);
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      default:
        return b === 0 ? NaN : a / b;
    }
  };
  return evaluate;
}
export type TestConfig = {
  capital: number;
  allocation: number;
  fee: number;
  slippage: number;
  gas: number;
  entry: string;
  exit: string;
  start: number;
  end: number;
};
export function backtest(bars: Bar[], config: TestConfig) {
  const { capital, allocation, fee, slippage, gas } = config;
  if (
    ![capital, allocation, fee, slippage, gas, config.start, config.end].every(Number.isFinite) ||
    capital <= 0 ||
    allocation <= 0 ||
    allocation > 1 ||
    fee < 0 ||
    fee > 0.05 ||
    slippage < 0 ||
    slippage > 0.05 ||
    gas < 0 ||
    gas >= capital * allocation ||
    config.end <= config.start
  )
    throw new Error("Check capital, allocation, costs and date range.");
  const entry = parseExpression(config.entry),
    exit = parseExpression(config.exit),
    evaluate = evaluator(bars);
  const indices = bars.map((b, i) => ({ b, i })).filter(({ b }) => b.time >= config.start && b.end <= config.end);
  if (indices.length < 3) throw new Error("At least three completed bars are required in the test window.");
  let cash = capital,
    units = 0,
    basis = 0,
    peak = capital,
    maxDrawdown = 0,
    peakTime = indices[0].b.time,
    longestDrawdown = 0,
    fees = 0,
    gasTotal = 0,
    slippageTotal = 0,
    exposed = 0,
    realized = 0;
  const trades: {
    time: number;
    side: string;
    price: number;
    quantity: number;
    notional: number;
    fee: number;
    gas: number;
    slippage: number;
    pnl: number | null;
    reason: string;
    cash: number;
  }[] = [];
  const points: {
    time: number;
    value: number;
    strategy: number;
    hold: number;
    drawdown: number;
    units: number;
    cash: number;
  }[] = [{ time: indices[0].b.time, value: capital, strategy: 0, hold: 0, drawdown: 0, units: 0, cash: capital }];
  const buyPrice = indices[0].b.open * (1 + slippage),
    holdUnits = (capital - gas) / (buyPrice * (1 + fee));
  let rejected = 0,
    readyBars = 0;
  const transact = (side: "Buy" | "Sell", rawPrice: number, time: number, reason: string) => {
    const price = rawPrice * (side === "Buy" ? 1 + slippage : 1 - slippage);
    const quantity = side === "Buy" ? (cash * allocation - gas) / (price * (1 + fee)) : units;
    if (quantity <= 0 || quantity * price * (1 - fee) < gas) {
      rejected++;
      return;
    }
    const notional = quantity * price,
      commission = notional * fee,
      slip = quantity * Math.abs(price - rawPrice);
    const pnl = side === "Sell" ? notional - commission - gas - basis : null;
    if (side === "Buy") {
      basis = notional + commission + gas;
      cash -= basis;
      units = quantity;
    } else {
      cash += notional - commission - gas;
      units = 0;
      realized += pnl!;
    }
    fees += commission;
    gasTotal += gas;
    slippageTotal += slip;
    trades.push({ time, side, price, quantity, notional, fee: commission, gas, slippage: slip, pnl, reason, cash });
  };
  for (const { b, i } of indices) {
    const entrySignal = evaluate(entry, i - 1),
      exitSignal = evaluate(exit, i - 1);
    if (Number.isFinite(entrySignal) && Number.isFinite(exitSignal)) readyBars++;
    // All signals use the preceding completed bar. Orders fill at this bar's open.
    if (units > 0 && exitSignal > 0) transact("Sell", b.open, b.time, "Exit signal");
    else if (units === 0 && entrySignal > 0) transact("Buy", b.open, b.time, "Entry signal");
    if (units > 0) exposed++;
    const last = b === indices.at(-1)!.b;
    if (last && units > 0) transact("Sell", b.close, b.end, "End-of-test liquidation");
    const value = cash + units * b.close;
    if (value >= peak) {
      if (points.at(-1)!.drawdown > 0) longestDrawdown = Math.max(longestDrawdown, b.end - peakTime);
      peak = value;
      peakTime = b.end;
    } else longestDrawdown = Math.max(longestDrawdown, b.end - peakTime);
    const drawdown = 1 - value / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    const holdValue = last ? holdUnits * b.close * (1 - slippage) * (1 - fee) - gas : holdUnits * b.close;
    points.push({
      time: b.end,
      value,
      strategy: value / capital - 1,
      hold: holdValue / capital - 1,
      drawdown,
      units,
      cash,
    });
  }
  const returns = points.slice(1).map((p, i) => p.value / points[i].value - 1),
    mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, returns.length - 1));
  const years = (points.at(-1)!.time - points[0].time) / (365 * 86400000),
    periods = returns.length / years;
  const closed = trades.filter(t => t.pnl !== null),
    winners = closed.filter(t => t.pnl! > 0),
    gains = winners.reduce((a, t) => a + t.pnl!, 0),
    losses = -closed.filter(t => t.pnl! < 0).reduce((a, t) => a + t.pnl!, 0);
  return {
    points,
    trades,
    capital,
    fees,
    gas: gasTotal,
    slippage: slippageTotal,
    maxDrawdown,
    longestDrawdown,
    sharpe: std > 1e-12 ? (mean / std) * Math.sqrt(periods) : null,
    volatility: std * Math.sqrt(periods),
    returnPct: points.at(-1)!.strategy,
    holdReturn: points.at(-1)!.hold,
    winRate: closed.length ? winners.length / closed.length : null,
    profitFactor: losses > 0 ? gains / losses : null,
    closed: closed.length,
    exposure: exposed / indices.length,
    realized,
    rejected,
    bars: indices.length,
    readyBars,
  };
}
