<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useWalletStore } from "../stores/wallet";
import { useNotifications } from "../composables/useNotifications";
import Identicon from "./Identicon.vue";
import { shortAddr } from "../utils/format";

const wallet = useWalletStore();
const notif = useNotifications();
const route = useRoute();

const boards = [
  { tag: "3can", name: "Decentralized Forum", cur: true },
  { tag: "g", name: "tech & code" },
  { tag: "d", name: "design" },
  { tag: "w3", name: "web3 & wallets" },
  { tag: "a", name: "art & media" },
  { tag: "p", name: "philosophy" },
  { tag: "r", name: "random" },
];

const isHome = computed(() => route.name === "home");

const needsInstall = computed(
  () => !!wallet.error && /not detected|install/i.test(wallet.error)
);

const balanceShort = computed(() => {
  if (wallet.balance === null || wallet.balance === undefined) return null;
  const n = parseFloat(wallet.balance);
  if (Number.isNaN(n)) return null;
  if (n < 0.0001) return n.toExponential(1);
  return n.toFixed(4);
});

async function enableNotifications() {
  await notif.request();
}
</script>

<template>
  <div class="top-strip">
    <span class="grp">
      <span class="bk">[</span>
      <template v-for="(b, i) in boards" :key="b.tag">
        <span v-if="i > 0" class="sl">/</span>
        <RouterLink to="/" :class="{ cur: b.cur && isHome }">{{ b.tag }}</RouterLink>
      </template>
      <span class="bk">]</span>
    </span>
    <span class="right">
      <span class="top-search">
        <input type="text" placeholder="search threads…" />
        <span class="ico">›</span>
      </span>
      <RouterLink to="/settings">[Settings]</RouterLink>
      <RouterLink v-if="wallet.isConnected" :to="`/profile/${wallet.address}`">
        [My posts]
      </RouterLink>
      <button
        v-if="notif.supported && notif.permission.value === 'default'"
        class="brackets-btn"
        @click="enableNotifications"
        title="Enable browser notifications"
      >
        [Notify]
      </button>
      <span v-if="wallet.isConnected && wallet.isOnSepolia && balanceShort" class="balance-pill" :title="`${wallet.balance} ETH`">
        {{ balanceShort }} ETH
      </span>
      <span
        v-if="!wallet.isConnected"
        class="wallet-pill disconnected"
        @click="wallet.connect()"
      >
        {{ wallet.connecting ? "Connecting…" : "Connect wallet" }}
      </span>
      <span
        v-else-if="!wallet.isOnSepolia"
        class="wallet-pill bad"
        @click="wallet.switchToSepolia()"
        title="Wrong network — click to switch"
      >
        Wrong network
      </span>
      <span
        v-else
        class="wallet-pill"
        @click="wallet.disconnect()"
        title="Click to disconnect"
      >
        <Identicon :address="wallet.address" :size="11" />
        <span class="mono">{{ shortAddr(wallet.address) }}</span>
      </span>
    </span>
  </div>

  <div v-if="wallet.error" class="wallet-error-bar">
    <span class="msg">⚠ {{ wallet.error }}</span>
    <a
      v-if="needsInstall"
      class="install-link"
      href="https://metamask.io/download/"
      target="_blank"
      rel="noopener"
      >Install MetaMask →</a
    >
    <span class="x" @click="wallet.dismissError()" title="dismiss">×</span>
  </div>
</template>

<style scoped>
.brackets-btn {
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--link);
  cursor: pointer;
  text-decoration: underline;
}
.brackets-btn:hover {
  color: var(--link-hover);
}
.wallet-error-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  background: #ffe6e6;
  border-bottom: 1px solid #e3a9a9;
  color: #8a1f1f;
  font-size: 12px;
}
.wallet-error-bar .msg {
  font-weight: 600;
}
.wallet-error-bar .install-link {
  color: #8a1f1f;
  font-weight: 700;
  text-decoration: underline;
  white-space: nowrap;
}
.wallet-error-bar .x {
  margin-left: auto;
  cursor: pointer;
  font-weight: 700;
  padding: 0 4px;
}
</style>
