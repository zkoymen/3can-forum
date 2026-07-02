<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useForum } from "../composables/useForum";
import { useWalletStore } from "../stores/wallet";
import { useBookmarks } from "../composables/useBookmarks";
import { boardBySlug, normalizeBoard } from "../boards";
import BoardHeader from "../components/BoardHeader.vue";
import Sidebar from "../components/Sidebar.vue";
import ThreadCard from "../components/ThreadCard.vue";
import ComposeModal from "../components/ComposeModal.vue";

const wallet = useWalletStore();
const bookmarks = useBookmarks();
const route = useRoute();
const {
  threads,
  postCountByThread,
  boardById,
  boardsResolved,
  loading,
  error,
  loadThreads,
  resolveBoards,
  loadAllPostCounts,
  notDeployed,
  watchNewThreads,
} = useForum();

const sort = ref("bump");
const tileSize = ref("small");
const showBody = ref("on");
const composeOpen = ref(false);
let stopWatch = null;

// Active board comes from the /b/:board route param. "" = the all view (/).
// A param that isn't a real slug is treated as an unknown board (empty listing).
const activeBoard = computed(() => normalizeBoard(route.params.board));
const activeBoardMeta = computed(() => boardBySlug(activeBoard.value));
const invalidBoard = computed(
  () => !!route.params.board && !activeBoardMeta.value
);

// Live per-board thread tallies for the sidebar, from resolved boards.
const boardCounts = computed(() => {
  const counts = {};
  for (const slug of Object.values(boardById.value)) {
    if (slug) counts[slug] = (counts[slug] || 0) + 1;
  }
  return counts;
});

// Restrict to the active board before sorting. On the all view, everything.
const boardScoped = computed(() => {
  if (invalidBoard.value) return [];
  if (!activeBoard.value) return threads.value;
  return threads.value.filter(
    (t) => boardById.value[t.threadId] === activeBoard.value
  );
});

const sorted = computed(() => {
  let list = [...boardScoped.value];
  if (sort.value === "bump") {
    list.sort((a, b) => b.blockNumber - a.blockNumber);
  } else if (sort.value === "creation") {
    list.sort((a, b) => b.timestamp - a.timestamp);
  } else if (sort.value === "replies") {
    list.sort((a, b) => {
      const ca = postCountByThread.value[a.threadId] ?? 0;
      const cb = postCountByThread.value[b.threadId] ?? 0;
      if (cb !== ca) return cb - ca;
      return b.blockNumber - a.blockNumber;
    });
  } else if (sort.value === "saved") {
    list = list.filter((t) => bookmarks.has(t.threadId));
    list.sort((a, b) => b.blockNumber - a.blockNumber);
  }
  return list;
});

const tileGrid = computed(() => ({
  gridTemplateColumns:
    tileSize.value === "large"
      ? "repeat(auto-fill, minmax(280px, 1fr))"
      : "repeat(auto-fill, minmax(210px, 1fr))",
}));

async function refresh() {
  await loadThreads();
  loadAllPostCounts();
  resolveBoards(); // background: fills board filters + sidebar counts
}

function openCompose() {
  if (!wallet.isConnected) {
    wallet.connect();
    return;
  }
  if (!wallet.isOnSepolia) {
    wallet.switchToSepolia();
    return;
  }
  composeOpen.value = true;
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(async () => {
  await refresh();
  try {
    stopWatch = watchNewThreads();
  } catch {
    /* listener may fail without an RPC; non-fatal */
  }
});

onUnmounted(() => {
  stopWatch?.();
});
</script>

<template>
  <BoardHeader
    :thread-count="threads.length"
    :board="activeBoardMeta"
    @compose="openCompose"
  />

  <div v-if="notDeployed()" class="info">
    The contract address has not been set yet. Deploy <code>Forum.sol</code> to
    Sepolia and the frontend will pick up the address automatically.
  </div>

  <div v-if="error" class="error">{{ error }}</div>

  <div class="toolbar">
    <span class="brackets">
      <a href="#" @click.prevent="scrollToTop">[Top]</a>
      <a href="#" @click.prevent="scrollToBottom">[Bottom]</a>
      <a href="#" @click.prevent="refresh">{{
        loading ? "[Loading…]" : "[Refresh]"
      }}</a>
      <a href="#" @click.prevent="openCompose">[Start a New Thread]</a>
    </span>
    <span class="pushed">
      <label>Sort By: </label>
      <select v-model="sort">
        <option value="bump">Bump order</option>
        <option value="creation">Creation date</option>
        <option value="replies">Reply count</option>
        <option value="saved">Saved only</option>
      </select>
    </span>
    <span>
      <label>Tile size: </label>
      <select v-model="tileSize">
        <option value="small">Small</option>
        <option value="large">Large</option>
      </select>
    </span>
    <span>
      <label>Show OP body: </label>
      <select v-model="showBody">
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
    </span>
  </div>

  <div class="cols">
    <div>
      <div v-if="invalidBoard" class="info">
        Unknown board <code>/{{ route.params.board }}/</code>. Pick a board from
        the list, or go back to <RouterLink to="/">/3can/</RouterLink>.
      </div>
      <div
        v-else-if="!loading && threads.length === 0 && !notDeployed()"
        class="info"
      >
        No threads yet. Be the first to post.
      </div>
      <div
        v-else-if="sort === 'saved' && sorted.length === 0"
        class="info"
      >
        No bookmarked threads. Tap ☆ on any tile to save it.
      </div>
      <div
        v-else-if="activeBoard && !boardsResolved && sorted.length === 0"
        class="info"
      >
        Loading /{{ activeBoard }}/…
      </div>
      <div
        v-else-if="activeBoard && boardsResolved && sorted.length === 0"
        class="info"
      >
        No threads on <code>/{{ activeBoard }}/</code> yet. Be the first to post.
      </div>
      <div class="catalog" :style="tileGrid">
        <ThreadCard
          v-for="t in sorted"
          :key="t.threadId"
          :thread="t"
          :reply-count="postCountByThread[t.threadId] ?? 0"
        />
      </div>
    </div>
    <Sidebar :counts="boardCounts" :active-board="activeBoard" />
  </div>

  <ComposeModal
    v-if="composeOpen"
    :default-board="activeBoard"
    @close="composeOpen = false"
    @created="
      composeOpen = false;
      refresh();
    "
  />
</template>
