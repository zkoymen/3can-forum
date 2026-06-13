/**
 * eth_getLogs is capped per request. Reads run through the dedicated/public read
 * providers (never the wallet), and those allow large windows: publicnode caps
 * at 50k blocks, tenderly takes the whole range. 45k stays under publicnode's
 * 50k while keeping the chunk count tiny (~5 for the current deploy->head span).
 * A capped dedicated RPC (e.g. Alchemy free tier, 10 blocks) just errors on the
 * first chunk and the caller rotates to a public node — see isNetworkError.
 *
 * queryFilterChunked splits the range into CHUNK_SIZE windows and fetches them
 * with bounded concurrency, then returns the concatenated events. Sequential
 * fetching was ~22 round-trips per filter at 9k (seconds of latency); batching
 * collapses that to one or two parallel rounds. Block ranges are inclusive on
 * both ends per the JSON-RPC spec (fromBlock = toBlock works).
 */
const CHUNK_SIZE = 45_000; // under publicnode's 50k cap; ~5 chunks for the range
const CONCURRENCY = 8; // parallel getLogs in flight per filter

export async function queryFilterChunked(contract, filter, fromBlock, toBlock) {
  const provider = contract.runner?.provider || contract.runner;
  if (!provider) throw new Error("Contract has no provider to resolve toBlock");

  const head =
    typeof toBlock === "number" ? toBlock : await provider.getBlockNumber();
  const start = typeof fromBlock === "number" ? fromBlock : 0;

  if (start > head) return [];

  // Build every [from, to] window up front...
  const ranges = [];
  for (let cursor = start; cursor <= head; cursor += CHUNK_SIZE) {
    ranges.push([cursor, Math.min(cursor + CHUNK_SIZE - 1, head)]);
  }

  // ...then fetch them in bounded-concurrency batches. A single chunk failure
  // rejects its batch, which bubbles up so the caller can rotate providers.
  const all = [];
  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = ranges.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(([from, to]) => contract.queryFilter(filter, from, to))
    );
    for (const events of results) {
      if (events.length > 0) all.push(...events);
    }
  }
  return all;
}

/**
 * Returns a (start, end) tuple for the most recent `windowBlocks` blocks
 * relative to `head`. Used by the home view to keep the cold-start fast:
 * we only need the last week or so of activity for first paint; older
 * threads can be loaded via "load more".
 */
export function recentWindow(head, windowBlocks) {
  const end = head;
  const start = Math.max(0, head - windowBlocks);
  return { start, end };
}
