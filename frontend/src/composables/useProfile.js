import { ref } from "vue";
import {
  useContract,
  rotateReadProvider,
  FALLBACK_RPC_COUNT,
} from "./useContract";
import { queryFilterChunked } from "./useEventQuery";

function isNetworkError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network error") ||
    m.includes("could not detect network") ||
    m.includes("timeout") ||
    m.includes("server response 5") ||
    m.includes("could not coalesce") ||
    m.includes("exceed maximum block range")
  );
}

/**
 * Reads everything a single address ever contributed: threads they opened,
 * posts they wrote, votes they cast. All three event types are indexed on
 * author/voter, so the filter happens server-side at the RPC.
 */
export function useProfile() {
  const { readContract, deployBlock } = useContract();

  const threads = ref([]);
  const posts = ref([]);
  const votes = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function loadProfile(address, attempt = 0) {
    if (!address) return;
    if (attempt === 0) {
      loading.value = true;
      error.value = null;
      threads.value = [];
      posts.value = [];
      votes.value = [];
    }
    try {
      const c = readContract.value;
      const fromBlock = deployBlock || 0;
      const [threadEvents, postEvents, voteEvents] = await Promise.all([
        queryFilterChunked(
          c,
          c.filters.ThreadCreated(null, address),
          fromBlock
        ),
        queryFilterChunked(
          c,
          c.filters.PostCreated(null, null, address),
          fromBlock
        ),
        queryFilterChunked(c, c.filters.PostVoted(null, address), fromBlock),
      ]);

      threads.value = threadEvents
        .map((e) => ({
          threadId: e.args.threadId.toString(),
          author: e.args.author,
          cid: e.args.cid,
          timestamp: Number(e.args.timestamp),
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber);

      posts.value = postEvents
        .map((e) => ({
          postId: e.args.postId.toString(),
          threadId: e.args.threadId.toString(),
          author: e.args.author,
          cid: e.args.cid,
          timestamp: Number(e.args.timestamp),
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber);

      votes.value = voteEvents
        .map((e) => ({
          postId: e.args.postId.toString(),
          voter: e.args.voter,
          newVoteCount: Number(e.args.newVoteCount),
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber);

      error.value = null;
    } catch (e) {
      if (attempt + 1 < FALLBACK_RPC_COUNT && isNetworkError(e)) {
        rotateReadProvider();
        return loadProfile(address, attempt + 1);
      }
      error.value = e.shortMessage || e.message || String(e);
    } finally {
      if (attempt === 0) loading.value = false;
    }
  }

  return { threads, posts, votes, loading, error, loadProfile };
}
