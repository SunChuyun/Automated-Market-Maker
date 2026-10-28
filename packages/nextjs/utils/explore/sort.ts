import type { CryptoAsset } from "./data";

export type MarketSort = "marketCap" | "price" | "change1h" | "change24h" | "fdv" | "volume24h";
export type SortDirection = "asc" | "desc";

export function compareAssets(a: CryptoAsset, b: CryptoAsset, field: MarketSort, direction: SortDirection) {
  const left = a[field];
  const right = b[field];
  // Missing data belongs at the end in either direction, rather than being treated as zero.
  if (left === null && right === null) return a.id.localeCompare(b.id);
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id);
}
