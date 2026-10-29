import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

// Match Next's extensionless TypeScript imports without changing production module resolution.
const source = readFileSync(new URL("./risk.ts", import.meta.url), "utf8").replace(
  '"./model"',
  JSON.stringify(new URL("./model.ts", import.meta.url).href),
);
const { INITIAL_PAPER, paperAction, rangePosition } = await import(
  `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
);
test("paper swaps retain LP fees and separate protocol funds from reserves", () => {
  const a = paperAction(INITIAL_PAPER, "buy", 1000, 0.003);
  assert.equal(a.poolUsdx, 250999.5);
  assert.equal(a.usdx, 9000);
  assert.ok(Math.abs(a.weth + a.poolWeth - 101) < 1e-10);
  assert.equal(a.events[0].feeUsdx, 3);
  assert.throws(() => paperAction(INITIAL_PAPER, "buy", 20000));
});
test("paper deposit and redemption conserve both tokens and LP ownership", () => {
  const a = paperAction(INITIAL_PAPER, "deposit", 0.5);
  assert.equal(a.shares, 0.5);
  assert.equal(a.totalShares, 100.5);
  const b = paperAction(a, "withdraw", 0.5);
  for (const key of ["weth", "usdx", "poolWeth", "poolUsdx", "shares", "totalShares"])
    assert.ok(Math.abs(b[key] - INITIAL_PAPER[key]) < 1e-9);
});
test("range inventory becomes one-sided beyond bounds and uses its own holding benchmark", () => {
  const low = rangePosition(10000, 2500, 1800, 3500, 1500),
    high = rangePosition(10000, 2500, 1800, 3500, 4000),
    flat = rangePosition(10000, 2500, 1800, 3500, 2500);
  assert.equal(low.usdx, 0);
  assert.equal(high.weth, 0);
  assert.equal(high.active, false);
  assert.ok(Math.abs(flat.value - 10000) < 1e-8);
  assert.ok(Math.abs(flat.relative) < 1e-12);
  assert.equal(rangePosition(10000, 2500, 3000, 3500, 2500), null);
});
