import { ref, onMounted, onUnmounted } from "vue";
import { useContract } from "./useContract";
import { timeAgo } from "../utils/format";

/**
 * Live "Mempool" feed — accumulates the most recent ThreadCreated,
 * PostCreated and PostVoted events as they arrive. Used by the sidebar
 * panel to show recent activity in the same shape as a 4chan-style
 * board mempool.
 */
const MAX_ITEMS = 8;

export function useMempool() {
  const { readContract } = useContract();
  const items = ref([]);

  function push(item) {
    items.value = [item, ...items.value].slice(0, MAX_ITEMS);
  }

  let stopFns = [];

  function attach() {
    try {
      const c = readContract.value;
      const onT = (threadId, _author, _cid, ts) => {
        push({
          type: "T",
          tag: `createThread() #${threadId}`,
          ts: Number(ts) || Math.floor(Date.now() / 1000),
        });
      };
      const onP = (postId, threadId, _author, _cid, ts) => {
        push({
          type: "R",
          tag: `createPost(#${threadId}) #${postId}`,
          ts: Number(ts) || Math.floor(Date.now() / 1000),
        });
      };
      const onV = (postId, _voter, newCount) => {
        push({
          type: "V",
          tag: `upvote(#${postId}) → ${newCount}`,
          ts: Math.floor(Date.now() / 1000),
        });
      };
      const fT = c.filters.ThreadCreated();
      const fP = c.filters.PostCreated();
      const fV = c.filters.PostVoted();
      c.on(fT, onT);
      c.on(fP, onP);
      c.on(fV, onV);
      stopFns = [
        () => c.off(fT, onT),
        () => c.off(fP, onP),
        () => c.off(fV, onV),
      ];
    } catch {
      // listener attach can fail in transient conditions; quietly skip
    }
  }

  onMounted(attach);
  onUnmounted(() => {
    stopFns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    stopFns = [];
  });

  function ageOf(ts) {
    return timeAgo(ts) + " ago";
  }

  return { items, ageOf };
}
