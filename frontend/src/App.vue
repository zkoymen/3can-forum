<script setup>
import { onMounted, onUnmounted } from "vue";
import { RouterView, useRouter } from "vue-router";
import { useWalletStore } from "./stores/wallet";
import { useContract } from "./composables/useContract";
import { useBookmarks } from "./composables/useBookmarks";
import { useNotifications } from "./composables/useNotifications";
import TopStrip from "./components/TopStrip.vue";
import config from "./config.json";
import { shortAddr } from "./utils/format";

const wallet = useWalletStore();
const router = useRouter();
const { readContract, explorerUrl } = useContract();
const bookmarks = useBookmarks();
const notif = useNotifications();

let stopBookmarkListener = null;

function startBookmarkListener() {
  if (stopBookmarkListener) return;
  try {
    const c = readContract.value;
    const filter = c.filters.PostCreated();
    const handler = (postId, threadId) => {
      const tid = threadId.toString();
      if (!bookmarks.has(tid)) return;
      notif.notify(
        "New reply on bookmarked thread",
        `Reply #${postId} on thread #${tid}`,
        () => {
          router.push(`/thread/${tid}`);
          window.focus();
        }
      );
    };
    c.on(filter, handler);
    stopBookmarkListener = () => c.off(filter, handler);
  } catch {
    /* RPC unavailable; will retry next mount */
  }
}

onMounted(() => {
  wallet.init();
  if (notif.permission.value === "granted") startBookmarkListener();
});

onUnmounted(() => {
  stopBookmarkListener?.();
});
</script>

<template>
  <div class="app">
    <TopStrip />
    <main class="page">
      <RouterView />
    </main>
    <footer class="footer">
      <div class="brackets">
        <a href="https://github.com/zkoymen/3can-forum" target="_blank" rel="noopener">GitHub</a>
        <a :href="explorerUrl(config.contractAddress, 'address')" target="_blank" rel="noopener">Etherscan</a>
      </div>
      <div class="mono" style="margin-top: 4px">
        Forum.sol · {{ shortAddr(config.contractAddress) }} · Sepolia · solc
        0.8.24 · MIT · no admin, no upgrade, no delete.
      </div>
      <div style="margin-top: 2px">© 3can {{ new Date().getFullYear() }}</div>
    </footer>
  </div>
</template>
