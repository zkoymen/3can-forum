<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useWalletStore } from "../stores/wallet";
import { useMempool } from "../composables/useMempool";
import { useContract } from "../composables/useContract";
import { BOARDS } from "../boards";
import Identicon from "./Identicon.vue";
import { shortAddr } from "../utils/format";
import config from "../config.json";

const props = defineProps({
  counts: { type: Object, default: () => ({}) }, // slug -> thread count
  activeBoard: { type: String, default: "" }, // slug of the board being viewed
});

const wallet = useWalletStore();
const mempool = useMempool();
const { explorerUrl } = useContract();

const boards = BOARDS;
function countFor(slug) {
  return props.counts[slug] ?? 0;
}

const balanceShort = computed(() => {
  if (!wallet.balance) return "—";
  const n = parseFloat(wallet.balance);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(4) + " ETH";
});
</script>

<template>
  <aside class="rail">
    <!-- Wallet -->
    <div class="panel">
      <div class="panel-head">Wallet</div>
      <div class="panel-body wallet-card">
        <template v-if="!wallet.isConnected">
          <div class="muted">Not connected.</div>
          <div class="muted">
            Reads work without signing; posting/voting needs a wallet on Sepolia.
          </div>
          <div class="actions">
            <button class="btn-primary" @click="wallet.connect()">
              Connect wallet
            </button>
          </div>
        </template>
        <template v-else>
          <div class="row">
            <Identicon :address="wallet.address" :size="18" />
            <RouterLink :to="`/profile/${wallet.address}`" class="addr">
              {{ shortAddr(wallet.address) }}
            </RouterLink>
          </div>
          <div class="row">
            <span class="muted">balance</span>
            <span class="balance">{{ balanceShort }}</span>
          </div>
          <div class="row">
            <span class="muted">network</span>
            <span class="mono">{{ wallet.isOnSepolia ? "Sepolia (11155111)" : "wrong network" }}</span>
          </div>
          <div class="actions">
            <RouterLink class="btn" :to="`/profile/${wallet.address}`">
              My posts
            </RouterLink>
            <a
              class="btn"
              :href="explorerUrl(wallet.address, 'address')"
              target="_blank"
              rel="noopener"
              style="text-decoration: none"
              >Etherscan</a
            >
            <button class="btn" @click="wallet.disconnect()">Disconnect</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Boards -->
    <div class="panel">
      <div class="panel-head">Boards</div>
      <div class="panel-body board-list">
        <RouterLink
          v-for="b in boards"
          :key="b.slug"
          class="board-pill"
          :class="{ active: b.slug === activeBoard }"
          :to="`/b/${b.slug}`"
        >
          <span class="tag">/{{ b.slug }}/</span>
          <span class="name">{{ b.name }}</span>
          <span class="count">{{ countFor(b.slug) }}</span>
        </RouterLink>
      </div>
    </div>

    <!-- Mempool -->
    <div class="panel">
      <div class="panel-head">Mempool</div>
      <div class="panel-body mempool">
        <div v-if="mempool.items.value.length === 0" class="empty">
          waiting for new events…
        </div>
        <div v-for="(m, i) in mempool.items.value" :key="i" class="row">
          <span
            class="ico"
            :class="{ r: m.type === 'R', v: m.type === 'V' }"
            >{{ m.type }}</span
          >
          <span class="tag">{{ m.tag }}</span>
          <span class="age">{{ mempool.ageOf(m.ts) }}</span>
        </div>
      </div>
    </div>

    <!-- Contract -->
    <div class="panel">
      <div class="panel-head">Contract</div>
      <div class="panel-body contract-info">
        <div><span class="k">name:</span> <span class="v">Forum.sol</span></div>
        <div>
          <span class="k">addr:</span>
          <span class="v">{{ shortAddr(config.contractAddress) }}</span>
        </div>
        <div>
          <span class="k">net :</span> Sepolia · chainId 11155111
        </div>
        <div><span class="k">solc:</span> 0.8.24 · viaIR off</div>
        <div>
          <span class="k">stat:</span>
          <span style="color: var(--ok)">verified</span> · no admin · no upgrade
        </div>
        <div style="margin-top: 4px">
          <a
            :href="explorerUrl(config.contractAddress, 'address')"
            target="_blank"
            rel="noopener"
            >view on Etherscan →</a
          >
        </div>
      </div>
    </div>
  </aside>
</template>
