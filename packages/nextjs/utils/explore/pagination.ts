export const MARKET_ORDERS = ["market_cap_desc", "volume_desc", "volume_asc"] as const;
export type MarketOrder = (typeof MARKET_ORDERS)[number];
export const TOKEN_BATCH_SIZE = 100;

export type BatchState<T> = {
  sourcePage: number;
  buffer: T[];
  seen: Set<string>;
  complete: boolean;
};

/** Consume source pages without losing filtered rows or repeating an asset across batches. */
export async function nextDistinctBatch<T extends { id: string }>(
  state: BatchState<T>,
  fetchPage: (page: number) => Promise<{ assets: T[]; complete: boolean }>,
): Promise<T[]> {
  const assets: T[] = [];
  while (assets.length < TOKEN_BATCH_SIZE) {
    if (!state.buffer.length) {
      if (state.complete) break;
      const batch = await fetchPage(state.sourcePage);
      state.sourcePage++;
      state.buffer = [...batch.assets];
      state.complete = batch.complete;
    }
    while (state.buffer.length && assets.length < TOKEN_BATCH_SIZE) {
      const asset = state.buffer.shift()!;
      if (!state.seen.has(asset.id)) {
        state.seen.add(asset.id);
        assets.push(asset);
      }
    }
  }
  return assets;
}
