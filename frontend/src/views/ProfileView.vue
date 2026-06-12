<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAddress } from "ethers";
import { useProfile } from "../composables/useProfile";
import { useContract } from "../composables/useContract";
import { useEns } from "../composables/useEns";
import { useProfilePic } from "../composables/useProfilePic";
import Identicon from "../components/Identicon.vue";
import { shortAddr, shortTx, dateStr, timeAgo } from "../utils/format";

const route = useRoute();
const router = useRouter();
const { threads, posts, votes, loading, error, loadProfile } = useProfile();
const { explorerUrl } = useContract();
const ens = useEns();
const profilePic = useProfilePic();

const tab = ref("all");
const ensName = ref(null);

const rawAddr = computed(() => String(route.params.address || ""));
const checksummed = computed(() => {
  try {
    return getAddress(rawAddr.value);
  } catch {
    return null;
  }
});

const all = computed(() => {
  return [
    ...threads.value.map((t) => ({
      kind: "thr",
      sortKey: t.timestamp,
      ...t,
    })),
    ...posts.value.map((p) => ({
      kind: "rep",
      sortKey: p.timestamp,
      ...p,
    })),
    ...votes.value.map((v) => ({
      kind: "vot",
      sortKey: 0,
      ...v,
    })),
  ].sort((x, y) => y.sortKey - x.sortKey);
});

const visible = computed(() => {
  if (tab.value === "all") return all.value;
  if (tab.value === "threads")
    return threads.value.map((t) => ({ kind: "thr", ...t }));
  if (tab.value === "replies")
    return posts.value.map((p) => ({ kind: "rep", ...p }));
  return votes.value.map((v) => ({ kind: "vot", ...v }));
});

function load() {
  if (checksummed.value) {
    loadProfile(checksummed.value);
    ens.lookup(checksummed.value).then((n) => (ensName.value = n));
  }
}

function back() {
  if (window.history.length > 1) router.back();
  else router.push("/");
}

const canGoBack = computed(() => window.history.length > 1);

onMounted(load);
watch(() => route.params.address, load);
</script>

<template>
  <a class="back-link" href="#" @click.prevent="back" v-if="canGoBack">
    <span class="arr">←</span> Back
  </a>

  <div v-if="!checksummed" class="error">
    Invalid wallet address: <code>{{ rawAddr }}</code>
  </div>

  <template v-else>
    <div class="crumb-bar">
      <a href="#" @click.prevent="router.push('/')">/3can/</a>
      <span class="sep">›</span>
      <span>profile</span>
      <span class="sep">·</span>
      <span class="mono">{{ checksummed }}</span>
    </div>

    <section class="prof-head">
      <img
        v-if="profilePic.getUrl(checksummed)"
        :src="profilePic.getUrl(checksummed)"
        class="avatar"
        alt=""
      />
      <Identicon v-else :address="checksummed" :size="56" />
      <div class="who">
        <h2>{{ ensName || shortAddr(checksummed) }}</h2>
        <div class="addr">{{ checksummed }}</div>
        <div class="meta">
          <a :href="explorerUrl(checksummed, 'address')" target="_blank" rel="noopener">Etherscan</a>
          ·
          <a href="#" @click.prevent="navigator.clipboard?.writeText(checksummed)">copy address</a>
        </div>
      </div>
      <div class="prof-stats">
        <div><span class="n">{{ threads.length }}</span>threads</div>
        <div><span class="n">{{ posts.length }}</span>replies</div>
        <div><span class="n">{{ votes.length }}</span>upvotes given</div>
      </div>
    </section>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="info">Loading…</div>

    <div class="activity-tabs">
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">All</button>
      <button :class="{ on: tab === 'threads' }" @click="tab = 'threads'">
        Threads
      </button>
      <button :class="{ on: tab === 'replies' }" @click="tab = 'replies'">
        Replies
      </button>
      <button :class="{ on: tab === 'votes' }" @click="tab = 'votes'">
        Upvotes
      </button>
    </div>

    <table class="activity-table" v-if="visible.length > 0">
      <thead>
        <tr>
          <th>Kind</th>
          <th>Where</th>
          <th>Time</th>
          <th>Tx</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in visible" :key="row.txHash + (row.postId ?? row.threadId ?? '')">
          <td :class="`kind ${row.kind}`">
            {{
              row.kind === "thr"
                ? "THREAD"
                : row.kind === "rep"
                ? "REPLY"
                : "UPVOTE"
            }}
          </td>
          <td>
            <a
              v-if="row.kind === 'thr'"
              href="#"
              @click.prevent="router.push(`/thread/${row.threadId}`)"
            >
              Thread #{{ row.threadId }}
            </a>
            <span v-else-if="row.kind === 'rep'">
              re:
              <a
                href="#"
                @click.prevent="router.push({ path: `/thread/${row.threadId}`, query: { focusPost: row.postId } })"
              >
                thread #{{ row.threadId }}
              </a>
              <span style="color: var(--ink-dim); margin-left: 6px; font-family: var(--f-mono); font-size: 10.5px">
                → No.{{ row.postId }}
              </span>
            </span>
            <a
              v-else
              href="#"
              @click.prevent="router.push({ path: `/thread/1`, query: { focusPost: row.postId } })"
            >
              upvoted post No.{{ row.postId }} (tally → {{ row.newVoteCount }})
            </a>
          </td>
          <td class="t">{{ row.timestamp ? dateStr(row.timestamp) : "—" }}</td>
          <td class="tx">
            <a :href="explorerUrl(row.txHash)" target="_blank" rel="noopener">{{
              shortTx(row.txHash)
            }}</a>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!loading" class="info">
      No on-chain activity yet for {{ shortAddr(checksummed) }}.
    </div>
  </template>
</template>

<style scoped>
.avatar {
  width: 56px;
  height: 56px;
  border: 1px solid var(--rule);
  object-fit: cover;
}
</style>
