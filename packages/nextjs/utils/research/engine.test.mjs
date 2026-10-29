import { STRATEGIES, backtest, evaluator, parseExpression } from "./engine.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const bars = prices =>
  prices.map((close, i) => ({
    time: i * 86400000,
    end: (i + 1) * 86400000,
    open: 100,
    high: Math.max(100, close),
    low: Math.min(100, close),
    close,
    volume: 1,
  }));
const config = {
  capital: 1000,
  allocation: 1,
  fee: 0,
  slippage: 0,
  gas: 0,
  entry: "close > 0",
  exit: "close < 0",
  start: 86400000,
  end: 5 * 86400000,
};
test("signals fill on the next open, and round-trip costs reconcile with equity", () => {
  const r = backtest(bars([100, 110, 105, 100, 100]), { ...config, fee: 0.003, slippage: 0.001, gas: 1 });
  assert.equal(r.trades[0].time, 86400000);
  assert.equal(r.trades[0].price, 100.1);
  assert.equal(r.trades.at(-1).reason, "End-of-test liquidation");
  assert.ok(Math.abs(r.realized - (r.points.at(-1).value - 1000)) < 1e-9);
  assert.ok(Math.abs(r.trades.reduce((s, t) => s + t.fee, 0) - r.fees) < 1e-9);
  assert.equal(r.points[0].strategy, 0);
  assert.equal(r.points[0].hold, 0);
  assert.ok(Math.abs(r.returnPct - r.holdReturn) < 1e-10);
});
test("a future bar cannot change earlier signals, fills, or equity", () => {
  const a = backtest(bars([100, 110, 90, 105, 200]), config),
    b = backtest(bars([100, 110, 90, 105, 50]), config);
  assert.deepEqual(a.points.slice(0, -1), b.points.slice(0, -1));
  assert.deepEqual(a.trades.slice(0, -1), b.trades.slice(0, -1));
});
test("flat no-cost equity has zero drawdown and no artificial recovery duration", () => {
  const r = backtest(bars([100, 100, 100, 100, 100]), config);
  assert.equal(r.maxDrawdown, 0);
  assert.equal(r.longestDrawdown, 0);
  assert.equal(r.sharpe, null);
});
test("drawdown duration counts peak-to-recovery rather than number of trades", () => {
  const r = backtest(bars([100, 100, 80, 70, 100]), config);
  assert.ok(Math.abs(r.maxDrawdown - 0.3) < 1e-12);
  assert.equal(r.longestDrawdown, 3 * 86400000);
});
test("restricted expressions reject arbitrary code, future access and malformed periods", () => {
  for (const text of ["process.exit()", "import('fs')", "close = 2", "sma(0)", "ema(10000)", "future(1)", "rsi(-14)"])
    assert.throws(() => parseExpression(text));
  for (const s of STRATEGIES) {
    parseExpression(s.entry);
    parseExpression(s.exit);
  }
  const evaluate = evaluator(bars(Array(40).fill(100)));
  assert.equal(evaluate(parseExpression("rsi(14)"), 20), 50);
  assert.ok(Number.isNaN(evaluate(parseExpression("sma(30)"), 10)));
});
test("invalid or excessive execution assumptions fail before producing a report", () => {
  assert.throws(() => backtest(bars([100, 100, 100, 100, 100]), { ...config, allocation: 2 }));
  assert.throws(() => backtest(bars([100, 100, 100, 100, 100]), { ...config, slippage: -1 }));
});
