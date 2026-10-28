import { nextDistinctBatch } from "./pagination.ts";
import { compareAssets } from "./sort.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const row = n => ({ id: `asset-${n}` });
test("source boundaries and duplicate IDs still yield full batches of exactly 100", async () => {
  const source = [
    Array.from({ length: 247 }, (_, i) => row(i)),
    [row(245), row(246), ...Array.from({ length: 150 }, (_, i) => row(247 + i))],
  ];
  const state = { sourcePage: 1, buffer: [], seen: new Set(), complete: false };
  const read = async page => ({ assets: source[page - 1] ?? [], complete: page >= source.length });
  const batches = [];
  for (let i = 0; i < 4; i++) batches.push(await nextDistinctBatch(state, read));
  assert.deepEqual(
    batches.map(b => b.length),
    [100, 100, 100, 97],
  );
  assert.equal(new Set(batches.flat().map(a => a.id)).size, 397);
  assert.equal(state.complete, true);
  assert.equal(state.buffer.length, 0);
  assert.equal((await nextDistinctBatch(state, read)).length, 0);
});
test("filter-empty source pages do not cause an incomplete middle batch", async () => {
  const state = { sourcePage: 1, buffer: [], seen: new Set(), complete: false };
  const result = await nextDistinctBatch(state, async page => ({
    assets: page < 4 ? [] : Array.from({ length: 120 }, (_, i) => row(i)),
    complete: page === 4,
  }));
  assert.equal(result.length, 100);
  assert.equal(state.buffer.length, 20);
});
test("sort handles negative changes, genuine zeroes and nulls in both directions", () => {
  const assets = [
    { id: "missing", change1h: null },
    { id: "flat", change1h: 0 },
    { id: "fall", change1h: -4 },
    { id: "rise", change1h: 2 },
  ];
  assert.deepEqual(
    assets.toSorted((a, b) => compareAssets(a, b, "change1h", "desc")).map(a => a.id),
    ["rise", "flat", "fall", "missing"],
  );
  assert.deepEqual(
    assets.toSorted((a, b) => compareAssets(a, b, "change1h", "asc")).map(a => a.id),
    ["fall", "flat", "rise", "missing"],
  );
});
