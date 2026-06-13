<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useForum } from "../composables/useForum";
import { useIpfs } from "../composables/useIpfs";
import { useContract } from "../composables/useContract";
import { useWalletStore } from "../stores/wallet";
import Identicon from "../components/Identicon.vue";
import PostBody from "../components/PostBody.vue";
import PostCard from "../components/PostCard.vue";
import CreatePostForm from "../components/CreatePostForm.vue";
import { shortAddr, shortCid, shortTx, dateStr } from "../utils/format";

const route = useRoute();
const router = useRouter();
const wallet = useWalletStore();
const ipfs = useIpfs();
const { explorerUrl } = useContract();
const {
  posts,
  votesByPostId,
  loading,
  error,
  fetchThreadMeta,
  loadPostsForThread,
  notDeployed,
  watchNewPostsOnThread,
  watchVotes,
} = useForum();

const threadMeta = ref(null);
const threadStatus = ref("loading"); // "loading" | "ok" | "missing" | "error"
const focusedPostId = ref(null);
const quoteSignal = ref(null); // { postId, seq } — pushes a >>N into the reply box
let quoteSeq = 0;
let stopPostWatch = null;
let stopVoteWatch = null;

async function load() {
  const id = route.params.id;
  threadMeta.value = null;
  threadStatus.value = "loading";

  const res = await fetchThreadMeta(id);
  if (res.ok) {
    threadMeta.value = res.meta;
    threadStatus.value = "ok";
  } else if (res.missing) {
    threadStatus.value = "missing"; // genuinely not on-chain
    return;
  } else {
    threadStatus.value = "error"; // RPC failed after retries — offer a retry
    return;
  }

  await loadPostsForThread(id);
  if (threadMeta.value?.contentHash) {
    try {
      const body = await ipfs.fetchJson(threadMeta.value.contentHash);
      threadMeta.value = { ...threadMeta.value, body };
    } catch {
      /* leave body unset */
    }
  }
}

function teardownWatchers() {
  stopPostWatch?.();
  stopVoteWatch?.();
  stopPostWatch = null;
  stopVoteWatch = null;
}

async function loadAndWatch() {
  teardownWatchers();
  await load();
  if (threadMeta.value) {
    try {
      stopPostWatch = watchNewPostsOnThread(route.params.id);
      stopVoteWatch = watchVotes();
    } catch {
      /* listener attach can fail; non-fatal */
    }
  }
  focusedPostId.value = route.query.focusPost
    ? String(route.query.focusPost)
    : null;
  if (focusedPostId.value) {
    // try repeatedly until DOM has rendered the target
    [50, 200, 450, 900].forEach((t) =>
      setTimeout(() => {
        const el = document.getElementById("post-" + focusedPostId.value);
        if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, t)
    );
  }
}

function clearFocus() {
  focusedPostId.value = null;
}

function scrollToReply(postNo) {
  focusedPostId.value = String(postNo);
  setTimeout(() => {
    const el = document.getElementById("post-" + postNo);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 30);
}

// Click a post's No./↩ to quote it: bump the signal so the reply form prepends
// >>N, then scroll the composer into view.
function quoteInReply(postId) {
  quoteSeq += 1;
  quoteSignal.value = { postId, seq: quoteSeq };
  setTimeout(() => {
    const el = document.getElementById("reply-box");
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 30);
}

function back() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

const canGoBack = computed(() => window.history.length > 1);

onMounted(loadAndWatch);
watch(() => route.params.id, loadAndWatch);
onUnmounted(teardownWatchers);
</script>

<template>
  <a class="back-link" href="#" @click.prevent="back" v-if="canGoBack">
    <span class="arr">←</span> Back
  </a>

  <div v-if="notDeployed()" class="info">Contract address not set.</div>
  <div v-else-if="threadStatus === 'loading' && !threadMeta" class="info">
    Loading thread #{{ route.params.id }}…
  </div>
  <div v-else-if="threadStatus === 'missing'" class="error">
    Thread #{{ route.params.id }} not found on-chain.
  </div>
  <div v-else-if="threadStatus === 'error'" class="error">
    Couldn’t reach the network while loading thread #{{ route.params.id }}.
    <a href="#" @click.prevent="loadAndWatch">Retry</a>
  </div>

  <template v-if="threadMeta">
    <div class="crumb-bar">
      <a href="#" @click.prevent="router.push('/')">/3can/</a>
      <span class="sep">›</span>
      <span>thread No.{{ threadMeta.id }}</span>
      <span class="sep">·</span>
      <span class="mono">{{ dateStr(threadMeta.timestamp) }}</span>
      <span class="sep">·</span>
      <a :href="explorerUrl(threadMeta.contentHash, 'address')" target="_blank" rel="noopener">Etherscan</a>
      <span class="sep">·</span>
      <a :href="ipfs.gatewayUrl(threadMeta.contentHash)" target="_blank" rel="noopener">IPFS</a>
    </div>

    <article class="op-post">
      <div class="op-meta">
        <span class="subj">{{ threadMeta.body?.title || `Thread #${threadMeta.id}` }}</span>
        <span class="anon">Anonymous</span>
        <Identicon :address="threadMeta.author" :size="14" />
        <a class="addr" href="#" @click.prevent="router.push(`/profile/${threadMeta.author}`)">
          {{ shortAddr(threadMeta.author) }}
        </a>
        <span class="date">{{ dateStr(threadMeta.timestamp) }}</span>
        <span class="no">No.<a href="#" @click.prevent>{{ threadMeta.id }}</a></span>
      </div>
      <div class="post-body" v-if="threadMeta.body?.body">
        <PostBody :text="threadMeta.body.body" />
      </div>
      <div class="post-body muted" v-else-if="threadMeta.contentHash">
        Body CID:
        <a :href="ipfs.gatewayUrl(threadMeta.contentHash)" target="_blank" rel="noopener">
          {{ shortCid(threadMeta.contentHash) }}
        </a>
      </div>
      <div class="op-foot">
        <span><span class="k">cid:</span> {{ shortCid(threadMeta.contentHash) }}</span>
        <span><span class="k">replies:</span> {{ posts.length }}</span>
      </div>
    </article>
  </template>

  <div v-if="error" class="error">{{ error }}</div>

  <div @click="clearFocus">
    <PostCard
      v-for="p in posts"
      :key="p.postId"
      :post="p"
      :thread="threadMeta"
      :votes="votesByPostId[p.postId] ?? 0"
      :focused="focusedPostId === p.postId"
      :mine="wallet.address && p.author.toLowerCase() === wallet.address.toLowerCase()"
      @quote-click="scrollToReply"
      @quote-post="quoteInReply"
    />
  </div>

  <CreatePostForm
    v-if="wallet.isConnected && wallet.isOnSepolia && !notDeployed() && threadMeta"
    id="reply-box"
    :thread-id="route.params.id"
    :first-post-id="posts[0]?.postId"
    :quote-signal="quoteSignal"
    @created="loadAndWatch"
  />
  <div v-else-if="!wallet.isConnected" class="info">
    Connect your wallet to reply.
  </div>
</template>
