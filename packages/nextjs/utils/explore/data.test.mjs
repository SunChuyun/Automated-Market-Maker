import { feeApr, finiteNumber, isCryptoAsset, safeExternalUrl, tokenPrice } from "./data.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("fee APR is reconciled to daily volume, liquidity and LP fee", () => {
  assert.ok(Math.abs(feeApr(100000, 500000) - 0.1825) < 1e-12);
  assert.ok(Math.abs(feeApr(100000, 500000, 0.0045) - 0.3285) < 1e-12);
  assert.equal(feeApr(100000, 0), null);
});
test("crypto list excludes tokenized commodity and stock instruments", () => {
  assert.equal(isCryptoAsset("bitcoin", "Bitcoin"), true);
  assert.equal(isCryptoAsset("usd-coin", "USDC"), true);
  assert.equal(isCryptoAsset("pax-gold", "Pax Gold"), false);
  assert.equal(isCryptoAsset("example", "Example xStock"), false);
  assert.equal(isCryptoAsset("example", "Example ETF"), false);
  assert.equal(isCryptoAsset("figure-heloc", "Figure Heloc"), false);
  assert.equal(isCryptoAsset("example", "Treasury Securities Fund"), false);
});
test("missing values remain distinct from a genuine zero price", () => {
  assert.equal(tokenPrice(null), "—");
  assert.equal(tokenPrice(0), "$0");
  assert.equal(tokenPrice(0.000001), "$0.000001");
  assert.equal(finiteNumber(Number.NaN), null);
});
test("external resource links accept web URLs and reject script schemes", () => {
  assert.equal(safeExternalUrl("https://bitcoin.org"), "https://bitcoin.org/");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,test"), null);
});
