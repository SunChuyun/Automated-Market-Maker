import { DEMO_PRICES, parsePriceCsv, runPoolResearch } from "./pool.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const c = {
  weth: 100,
  usdx: 250000,
  capital: 10000,
  orderCap: 1000,
  poolFee: 0.003,
  externalFee: 0.001,
  slippage: 0.0005,
  gas: 1,
  minProfit: 1,
  minEdge: 0.005,
};
const obs = prices => prices.map((price, i) => ({ time: Date.UTC(2026, 0, 1) + i * 3600000, price }));
test("a flat aligned market generates no artificial arbitrage", () => {
  assert.equal(runPoolResearch(obs([2500, 2500, 2500]), c).trades.length, 0);
});
test("both routes move pool spot toward reference and conserve cash after costs", () => {
  for (const prices of [
    [2500, 2700, 2700],
    [2500, 2300, 2300],
  ]) {
    const r = runPoolResearch(obs(prices), c);
    assert.ok(r.trades.length > 0);
    for (const t of r.trades) {
      assert.ok(t.profit > c.minProfit);
      assert.ok(Math.abs(t.after / t.reference - 1) < Math.abs(t.before / t.reference - 1));
      assert.ok(Math.abs(t.profit - (t.output - t.input - t.gas)) < 1e-9);
    }
    assert.ok(Math.abs(r.trades.reduce((s, t) => s + t.profit, 0) - r.profit) < 1e-8);
    assert.ok(r.weth > 0 && r.usdx > 0);
  }
});
test("raising costs filters opportunities; future references cannot change earlier decisions", () => {
  const costly = runPoolResearch(DEMO_PRICES, { ...c, gas: 9000 });
  assert.equal(costly.trades.length, 0);
  assert.equal(costly.holdLiquidated, false);
  assert.ok(costly.points.every(p => p.hold >= -1));
  const a = runPoolResearch(obs([2500, 2700, 2800]), c),
    b = runPoolResearch(obs([2500, 2700, 2300]), c);
  assert.deepEqual(
    a.trades.filter(t => t.time < obs([1, 1, 1])[2].time),
    b.trades.filter(t => t.time < obs([1, 1, 1])[2].time),
  );
  assert.deepEqual(a.points.slice(0, -1), b.points.slice(0, -1));
});
test("CSV accepts explicit UTC timestamps, rejects duplicates and invalid formats", () => {
  assert.equal(
    parsePriceCsv("timestamp,price\n2026-01-01T00:00:00Z,2500\n2026-01-01T01:00:00Z,2600\n2026-01-01T02:00:00Z,2450")
      .length,
    3,
  );
  assert.throws(() => parsePriceCsv("timestamp,price\n1,2500\n1,2600\n2,2450"));
  assert.throws(() => parsePriceCsv("date,close\n1,2\n2,3\n3,4"));
});
