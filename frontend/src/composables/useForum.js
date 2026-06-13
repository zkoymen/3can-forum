import { ref } from "vue";
import {
  useContract,
  rotateReadProvider,
  FALLBACK_RPC_COUNT,
} from "./useContract";
import { queryFilterChunked } from "./useEventQuery";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function isNetworkError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network error") ||
    m.includes("could not detect network") ||
    m.includes("timeout") ||
    m.includes("server response 5") ||
    m.includes("could not coalesce") ||
    m.includes("exceed maximum block range") ||
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("429") ||
    // getLogs range/size caps (e.g. Alchemy free tier's 10-block limit, Infura's
    // 10k-result cap). Treat as retryable so we rotate to a provider that allows
    // our chunk size instead of surfacing the error.
    m.includes("block range") ||
    m.includes("query returned more than") ||
    m.includes("response size") ||
    m.includes("up to a")
  );
}

// Tells a genuinely-missing thread apart from a transient RPC failure.
// getThread() reverts with ThreadDoesNotExist when the thread really isn't
// on-chain; ethers surfaces a contract revert as code CALL_EXCEPTION, and that
// is the ONLY revert getThread can produce. A network/rate-limit failure is a
// different code (and matches isNetworkError) — those we retry, not report as
// "not found".
function isMissingThreadRevert(e) {
  if (e?.revert?.name === "ThreadDoesNotExist") return true;
  if ((e?.message || "").toLowerCase().includes("threaddoesnotexist")) {
    return true;
  }
  return e?.code === "CALL_EXCEPTION" && !isNetworkError(e);
}

/**
 * Reads threads / posts / votes directly from on-chain event logs via
 * contract.queryFilter. The browser is the indexer; no off-chain server.
 */
export function useForum() {
  const { readContract, deployBlock, contractAddress } = useContract();

  const threads = ref([]);
  const posts = ref([]); // current thread's posts
  const votesByPostId = ref({}); // postId (string) -> count
  const postCountByThread = ref({}); // threadId (string) -> reply count
  const loading = ref(false);
  const error = ref(null);

  function notDeployed() {
    return (
      !contractAddress ||
      contractAddress === ZERO_ADDR ||
      contractAddress.toLowerCase() === ZERO_ADDR
    );
  }

  async function loadThreads(attempt = 0) {
    if (notDeployed()) {
      error.value =
        "Contract address not set. Run `npm run deploy:sepolia` from contracts/.";
      return;
    }
    if (attempt === 0) {
      loading.value = true;
      error.value = null;
    }
    try {
      const c = readContract.value;
      const filter = c.filters.ThreadCreated();
      const events = await queryFilterChunked(c, filter, deployBlock || 0);
      threads.value = events
        .map((e) => ({
          threadId: e.args.threadId.toString(),
          author: e.args.author,
          cid: e.args.cid,
          timestamp: Number(e.args.timestamp),
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber);
      error.value = null;
    } catch (e) {
      if (attempt + 1 < FALLBACK_RPC_COUNT && isNetworkError(e)) {
        rotateReadProvider();
        return loadThreads(attempt + 1);
      }
      error.value = e.shortMessage || e.message || String(e);
    } finally {
      if (attempt === 0) loading.value = false;
    }
  }

  /**
   * Reads a single thread's on-chain metadata with provider rotation/retry.
   * Returns:
   *   { ok: true, meta }            -> thread exists
   *   { ok: false, missing: true }  -> thread genuinely not on-chain (revert)
   *   { ok: false, error }          -> RPC failed after retries (NOT "missing")
   * Distinguishing the last two is what stops a rate-limited read from being
   * mislabelled "Thread #N not found on-chain".
   */
  async function fetchThreadMeta(threadId, attempt = 0) {
    try {
      const raw = await readContract.value.getThread(threadId);
      return {
        ok: true,
        meta: {
          id: raw.id,
          author: raw.author,
          contentHash: raw.contentHash,
          timestamp: Number(raw.timestamp),
        },
      };
    } catch (e) {
      if (isMissingThreadRevert(e)) return { ok: false, missing: true };
      if (attempt + 1 < FALLBACK_RPC_COUNT && isNetworkError(e)) {
        rotateReadProvider();
        return fetchThreadMeta(threadId, attempt + 1);
      }
      return {
        ok: false,
        missing: false,
        error: e.shortMessage || e.message || String(e),
      };
    }
  }

  async function loadPostsForThread(threadId, attempt = 0) {
    if (notDeployed()) {
      error.value =
        "Contract address not set. Run `npm run deploy:sepolia` from contracts/.";
      return;
    }
    if (attempt === 0) {
      loading.value = true;
      error.value = null;
    }
    try {
      const c = readContract.value;
      const filter = c.filters.PostCreated(null, BigInt(threadId));
      const events = await queryFilterChunked(c, filter, deployBlock || 0);
      const list = events
        .map((e) => ({
          postId: e.args.postId.toString(),
          threadId: e.args.threadId.toString(),
          author: e.args.author,
          cid: e.args.cid,
          timestamp: Number(e.args.timestamp),
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
        }))
        .sort((a, b) => a.blockNumber - b.blockNumber);
      posts.value = list;
      await loadVotesFor(list.map((p) => p.postId));
      error.value = null;
    } catch (e) {
      if (attempt + 1 < FALLBACK_RPC_COUNT && isNetworkError(e)) {
        rotateReadProvider();
        return loadPostsForThread(threadId, attempt + 1);
      }
      error.value = e.shortMessage || e.message || String(e);
    } finally {
      if (attempt === 0) loading.value = false;
    }
  }

  async function loadAllPostCounts(attempt = 0) {
    try {
      const c = readContract.value;
      const filter = c.filters.PostCreated();
      const events = await queryFilterChunked(c, filter, deployBlock || 0);
      const counts = {};
      for (const e of events) {
        const tid = e.args.threadId.toString();
        counts[tid] = (counts[tid] || 0) + 1;
      }
      postCountByThread.value = counts;
    } catch (e) {
      if (attempt + 1 < FALLBACK_RPC_COUNT && isNetworkError(e)) {
        rotateReadProvider();
        return loadAllPostCounts(attempt + 1);
      }
      // non-fatal: trending sort just falls back to newest
    }
  }

  async function loadVotesFor(postIds) {
    if (postIds.length === 0) return;
    const c = readContract.value;
    const filter = c.filters.PostVoted();
    const events = await queryFilterChunked(c, filter, deployBlock || 0);

    const tallies = {};
    for (const e of events) {
      const pid = e.args.postId.toString();
      const latest = Number(e.args.newVoteCount);
      if (tallies[pid] === undefined || latest > tallies[pid]) {
        tallies[pid] = latest;
      }
    }
    const next = { ...votesByPostId.value };
    for (const pid of postIds) {
      next[pid] = tallies[pid] ?? 0;
    }
    votesByPostId.value = next;
  }

  async function hasVoted(postId, address) {
    if (!address) return false;
    try {
      const c = readContract.value;
      return await c.hasVoted(postId, address);
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to ThreadCreated events; live-append new threads to `threads`.
   * Returns an unsubscribe function for onUnmounted cleanup.
   * Uses ethers' polling-event mechanism — works on plain HTTP providers.
   */
  function watchNewThreads() {
    const c = readContract.value;
    const filter = c.filters.ThreadCreated();
    const handler = (threadId, author, cid, timestamp, event) => {
      const id = threadId.toString();
      if (threads.value.some((t) => t.threadId === id)) return;
      threads.value = [
        {
          threadId: id,
          author,
          cid,
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          txHash: event.log.transactionHash,
        },
        ...threads.value,
      ];
    };
    c.on(filter, handler);
    return () => {
      c.off(filter, handler);
    };
  }

  /**
   * Subscribe to PostCreated for a specific thread; live-append to `posts`
   * and bump the reply count.
   */
  function watchNewPostsOnThread(threadId) {
    const c = readContract.value;
    const filter = c.filters.PostCreated(null, BigInt(threadId));
    const handler = (postId, tid, author, cid, timestamp, event) => {
      const pid = postId.toString();
      if (posts.value.some((p) => p.postId === pid)) return;
      posts.value = [
        ...posts.value,
        {
          postId: pid,
          threadId: tid.toString(),
          author,
          cid,
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          txHash: event.log.transactionHash,
        },
      ];
      votesByPostId.value = { ...votesByPostId.value, [pid]: 0 };
    };
    c.on(filter, handler);
    return () => {
      c.off(filter, handler);
    };
  }

  /**
   * Subscribe to PostVoted events; keep votesByPostId fresh.
   */
  function watchVotes() {
    const c = readContract.value;
    const filter = c.filters.PostVoted();
    const handler = (postId, voter, newVoteCount) => {
      votesByPostId.value = {
        ...votesByPostId.value,
        [postId.toString()]: Number(newVoteCount),
      };
    };
    c.on(filter, handler);
    return () => {
      c.off(filter, handler);
    };
  }

  return {
    threads,
    posts,
    votesByPostId,
    postCountByThread,
    loading,
    error,
    loadThreads,
    fetchThreadMeta,
    loadPostsForThread,
    loadVotesFor,
    loadAllPostCounts,
    hasVoted,
    notDeployed,
    watchNewThreads,
    watchNewPostsOnThread,
    watchVotes,
  };
}
