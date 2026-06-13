<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useIpfs } from "../composables/useIpfs";
import { useBookmarks } from "../composables/useBookmarks";
import Identicon from "./Identicon.vue";
import PostBody from "./PostBody.vue";
import { shortAddr, timeAgo, previewBody } from "../utils/format";

const props = defineProps({
  thread: { type: Object, required: true },
  replyCount: { type: Number, default: 0 },
});

const router = useRouter();
const ipfs = useIpfs();
const bookmarks = useBookmarks();
const body = ref(null);
const loadFailed = ref(false);

const bookmarked = computed(() => bookmarks.has(props.thread.threadId));

const previewText = computed(() => {
  if (!body.value) return "";
  return previewBody(body.value.body || "", 180);
});

function open() {
  router.push(`/thread/${props.thread.threadId}`);
}

function toggleBookmark(e) {
  e.preventDefault();
  e.stopPropagation();
  bookmarks.toggle(props.thread.threadId);
}

function openAuthor(e) {
  e.preventDefault();
  e.stopPropagation();
  router.push(`/profile/${props.thread.author}`);
}

onMounted(async () => {
  try {
    body.value = await ipfs.fetchJson(props.thread.cid);
  } catch {
    loadFailed.value = true;
  }
});
</script>

<template>
  <div class="tile" @click="open">
    <div class="tile-head">
      <span class="pn">No.{{ thread.threadId }}</span>
      <span class="tag">/3can/</span>
      <button
        class="star"
        :class="{ off: !bookmarked }"
        @click="toggleBookmark"
        :title="bookmarked ? 'Remove from saved' : 'Save'"
      >
        {{ bookmarked ? "★" : "☆" }}
      </button>
    </div>
    <div class="tile-body">
      <div class="title">
        <template v-if="body?.title">{{ body.title }}</template>
        <template v-else-if="loadFailed">Thread #{{ thread.threadId }} (IPFS body unreachable)</template>
        <template v-else>Loading…</template>
      </div>
      <div v-if="previewText" class="preview">
        <PostBody :text="previewText" preview />
      </div>
    </div>
    <div class="tile-foot">
      <a href="#" class="author" @click="openAuthor">
        <Identicon :address="thread.author" :size="11" />
        <span>{{ shortAddr(thread.author) }}</span>
      </a>
      <span>
        <span class="r">R:{{ replyCount }}</span>
      </span>
      <span class="age">{{ timeAgo(thread.timestamp) }}</span>
    </div>
  </div>
</template>
