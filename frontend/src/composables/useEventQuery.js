/**
 * eth_getLogs is capped per request, and the cap depends on the provider:
 * Infura / Alchemy / MetaMask allow ~10k blocks; the public nodes allow up to
 * ~50k. 9_000 stays under the strictest cap, so the SAME call succeeds whether
 * a read goes through a connected wallet (MetaMask -> Infura) or a public
 * fallback. A larger window fails with "block range too large" — which ethers
 * often surfaces as "could not coalesce error" — exactly when a wallet is
 * connected, i.e. right when you post and then refresh.
 *
 * queryFilterChunked walks the range in CHUNK_SIZE windows, returns the
 * concatenated event list. Block ranges are inclusive on both ends per the
 * JSON-RPC spec (fromBlock = toBlock works).
 */
const CHUNK_SIZE = 9_000; // under the strictest (Infura/Alchemy/MetaMask) 10k cap

export async function queryFilterChunked(contract, filter, fromBlock, toBlock) {
  const provider = contract.runner?.provider || contract.runner;
  if (!provider) throw new Error("Contract has no provider to resolve toBlock");

  const head =
    typeof toBlock === "number" ? toBlock : await provider.getBlockNumber();
  const start = typeof fromBlock === "number" ? fromBlock : 0;

  if (start > head) return [];

  const all = [];
  let cursor = start;
  while (cursor <= head) {
    const end = Math.min(cursor + CHUNK_SIZE - 1, head);
    const events = await contract.queryFilter(filter, cursor, end);
    if (events.length > 0) all.push(...events);
    cursor = end + 1;
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
