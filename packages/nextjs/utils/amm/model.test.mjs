import { impermanentLoss, quoteSwap, runDca } from "./model.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("constant-product quote separates swap fees from curve impact", () => {
  const q = quoteSwap(1, 100, 250_000);
  assert.ok(Math.abs(q.output - 2467.895085992653) < 1e-8);
  assert.equal(q.fee, 0.003);
  assert.ok(quoteSwap(10, 100, 250_000).impact > q.impact);
  assert.equal(quoteSwap(-1, 100, 250_000), null);
  assert.equal(quoteSwap(Number.NaN, 100, 250_000), null);
});

test("impermanent loss is zero at unchanged prices and symmetric in the price ratio", () => {
  assert.equal(impermanentLoss(1), 0);
  assert.ok(Math.abs(impermanentLoss(4) + 0.2) < 1e-12);
  assert.equal(impermanentLoss(4), impermanentLoss(0.25));
});

test("DCA includes idle cash and fees, with hand-reconciled terminal value", () => {
  const candles = [100, 200, 100].map((close, i) => ({ close, time: i * 3_600_000 }));
  const result = runDca(candles, 1000, 2);
  assert.equal(result.trades.length, 2);
  assert.equal(result.fees, 3);
  assert.ok(Math.abs(result.finalValue - 997) < 1e-10);
  assert.ok(Math.abs(result.holdValue - 997) < 1e-10);
  assert.equal(result.points[0].value, 998.5);
  assert.ok(Math.abs(result.maxDrawdown - (1 - 997 / 1497)) < 1e-12);
});

test("changing a future close cannot alter an earlier purchase or equity value", () => {
  const series = last => [100, 150, last].map((close, i) => ({ close, time: i * 3_600_000 }));
  const a = runDca(series(200), 1000, 1);
  const b = runDca(series(50), 1000, 1);
  assert.deepEqual(a.trades.slice(0, 2), b.trades.slice(0, 2));
  assert.deepEqual(a.points.slice(0, 2), b.points.slice(0, 2));
});
