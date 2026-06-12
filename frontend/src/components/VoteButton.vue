<script setup>
import { onMounted, ref, watch } from "vue";
import { useContract } from "../composables/useContract";
import { useForum } from "../composables/useForum";
import { useWalletStore } from "../stores/wallet";

const props = defineProps({
  postId: { type: [String, Number], required: true },
  votes: { type: Number, default: 0 },
});
const emit = defineEmits(["voted"]);

const wallet = useWalletStore();
const { writeContract } = useContract();
const { hasVoted } = useForum();

const submitting = ref(false);
const alreadyVoted = ref(false);
const error = ref(null);

async function refreshHasVoted() {
  if (wallet.address) {
    alreadyVoted.value = await hasVoted(props.postId, wallet.address);
  } else {
    alreadyVoted.value = false;
  }
}

onMounted(refreshHasVoted);
watch(() => wallet.address, refreshHasVoted);

async function vote() {
  if (!writeContract.value) {
    error.value = "Connect a Sepolia wallet to vote.";
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const tx = await writeContract.value.upvote(props.postId);
    await tx.wait();
    alreadyVoted.value = true;
    wallet.refreshBalance().catch(() => {});
    emit("voted");
  } catch (e) {
    error.value = e.shortMessage || e.message || String(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <span class="vote">
    <button
      :class="{ on: alreadyVoted }"
      :disabled="
        submitting ||
        alreadyVoted ||
        !wallet.isConnected ||
        !wallet.isOnSepolia
      "
      :title="
        !wallet.isConnected
          ? 'Connect wallet to vote'
          : !wallet.isOnSepolia
          ? 'Switch to Sepolia'
          : alreadyVoted
          ? 'You already voted'
          : 'upvote()'
      "
      @click="vote"
    >
      [{{ submitting ? "…" : alreadyVoted ? "+voted" : "+1" }}]
    </button>
    <span class="n">{{ votes }}</span>
  </span>
</template>
