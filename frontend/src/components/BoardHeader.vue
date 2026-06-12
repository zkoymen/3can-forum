<script setup>
import { useChainMeta } from "../composables/useChainMeta";
import CanLogo from "./CanLogo.vue";
import config from "../config.json";
import { shortAddr } from "../utils/format";

defineProps({
  threadCount: { type: Number, default: 0 },
});
const emit = defineEmits(["compose"]);

const { blockNumber, gasGwei } = useChainMeta();

function compose(e) {
  e.preventDefault();
  emit("compose");
}
</script>

<template>
  <div>
    <div class="brand-block">
      <span class="brand-mark"><CanLogo :size="36" /></span>
      <span class="brand-text">3<em>can</em></span>
      <span class="brand-tag">on-chain bulletin board · sepolia testnet</span>
    </div>

    <div class="board-title">/3can/ — Decentralized Forum</div>
    <hr />

    <div class="new-thread-line">
      <a href="#" @click="compose">[Start a New Thread]</a>
    </div>

    <div class="news-strip">
      <div class="row">
        <span class="when">26/05/26</span>{{ " " }}
        <span class="label">protocol:</span>
        ProfileView shipped — every wallet now has an activity page at
        <code>/profile/0x…</code>.
      </div>
      <div class="row">
        <span class="when">22/05/26</span>{{ " " }}
        <span class="label">gas:</span>
        <code>upvote()</code> costs 53k–70k depending on cold-slot vote. Reads
        are zero-gas.
      </div>
      <div class="row">
        <span class="when">16/05/26</span>{{ " " }}
        <span class="label">launch:</span>
        Forum.sol deployed and verified on Sepolia. {{ threadCount }}+ threads
        on-chain since.
      </div>
    </div>

    <div class="chain-meta">
      <b>Forum.sol</b><span class="dot">·</span>
      <span>{{ shortAddr(config.contractAddress) }} (verified)</span><span class="dot">·</span>
      <span>Sepolia</span><span class="dot">·</span>
      <span>block <b>#{{ blockNumber ?? "—" }}</b></span><span class="dot">·</span>
      <span>gas <b>{{ gasGwei ?? "—" }} gwei</b></span>
    </div>
  </div>
</template>
