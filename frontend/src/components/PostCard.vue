<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useIpfs } from "../composables/useIpfs";
import { useContract } from "../composables/useContract";
import Identicon from "./Identicon.vue";
import PostBody from "./PostBody.vue";
import VoteButton from "./VoteButton.vue";
import { shortAddr, shortCid, shortTx, dateStr } from "../utils/format";

const props = defineProps({
  post: { type: Object, required: true },
  thread: { type: Object, default: null },
  votes: { type: Number, default: 0 },
  focused: { type: Boolean, default: false },
  mine: { type: Boolean, default: false },
});
const emit = defineEmits(["voted", "quoteClick"]);

const router = useRouter();
const ipfs = useIpfs();
const { explorerUrl } = useContract();
const body = ref(null);
const loadFailed = ref(false);

const isOp = computed(
  () => props.thread && props.post.author === props.thread.author
);

const cls = computed(() => ({
  reply: true,
  mine: props.mine && !props.focused,
  focused: props.focused,
}));

onMounted(async () => {
  try {
    body.value = await ipfs.fetchJson(props.post.cid);
  } catch {
    loadFailed.value = true;
  }
});

function openProfile(e) {
  e.preventDefault();
  router.push(`/profile/${props.post.author}`);
}
</script>

<template>
  <div class="reply-row" :id="`post-${post.postId}`">
    <span class="arrow">&gt;&gt;</span>
    <div :class="cls" @click.stop>
      <div class="reply-meta">
        <span :class="isOp ? 'name' : 'anon'">{{
          isOp ? "Anonymous (OP)" : "Anonymous"
        }}</span>
        <span v-if="mine" class="you">you</span>
        <Identicon :address="post.author" :size="12" />
        <a class="addr" href="#" @click="openProfile">
          {{ shortAddr(post.author) }}
        </a>
        <span class="date">{{ dateStr(post.timestamp) }}</span>
        <span class="no">No.<a href="#" @click.prevent="emit('quoteClick', post.postId)">{{ post.postId }}</a></span>
        <VoteButton
          :post-id="post.postId"
          :votes="votes"
          @voted="emit('voted')"
        />
      </div>
      <div class="post-body" v-if="body?.body">
        <PostBody :text="body.body" @quote-click="(id) => emit('quoteClick', id)" />
      </div>
      <div class="post-body muted" v-else-if="loadFailed">
        IPFS body unreachable. CID:
        <a :href="ipfs.gatewayUrl(post.cid)" target="_blank" rel="noopener">
          {{ shortCid(post.cid) }}
        </a>
      </div>
      <div class="post-body muted" v-else>Loading…</div>
      <div class="reply-foot">
        <span class="k">cid:</span> {{ shortCid(post.cid) }}
        <span class="k" style="margin-left: 8px">tx:</span>
        <a :href="explorerUrl(post.txHash)" target="_blank" rel="noopener">{{
          shortTx(post.txHash)
        }}</a>
      </div>
    </div>
  </div>
</template>
