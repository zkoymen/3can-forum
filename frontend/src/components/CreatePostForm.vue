<script setup>
import { ref, watch, nextTick } from "vue";
import { useContract } from "../composables/useContract";
import { useIpfs } from "../composables/useIpfs";
import { useWalletStore } from "../stores/wallet";
import { shortAddr } from "../utils/format";

const props = defineProps({
  threadId: { type: [String, Number], required: true },
  firstPostId: { type: [String, Number], default: null },
  quoteSignal: { type: Object, default: null },
});
const emit = defineEmits(["created"]);

const { writeContract, explorerUrl } = useContract();
const ipfs = useIpfs();
const wallet = useWalletStore();

const body = ref("");
const submitting = ref(false);
const error = ref(null);
const successTx = ref(null);
const ta = ref(null);

// ThreadView bumps quoteSignal when a post's No./↩ is clicked — prepend ">>N"
// to the current draft and focus the box so the user can keep typing.
watch(
  () => props.quoteSignal,
  (sig) => {
    if (!sig || sig.postId == null) return;
    const marker = ">>" + sig.postId + "\n";
    const cur = body.value;
    body.value = cur && !cur.endsWith("\n") ? cur + "\n" + marker : cur + marker;
    nextTick(() => ta.value && ta.value.focus());
  }
);

async function submit() {
  if (!body.value.trim()) {
    error.value = "Reply body is empty.";
    return;
  }
  submitting.value = true;
  error.value = null;
  successTx.value = null;
  try {
    const payload = {
      body: body.value.trim(),
      createdAt: new Date().toISOString(),
      kind: "post",
      threadId: props.threadId.toString(),
    };
    const cid = await ipfs.upload(payload);
    const tx = await writeContract.value.createPost(props.threadId, cid);
    const receipt = await tx.wait();
    successTx.value = receipt.hash;
    body.value = "";
    wallet.refreshBalance().catch(() => {});
    emit("created");
  } catch (e) {
    error.value = e.shortMessage || e.message || String(e);
  } finally {
    submitting.value = false;
  }
}

function clear() {
  body.value = "";
  error.value = null;
}
</script>

<template>
  <form class="compose" @submit.prevent="submit">
    <div class="row">
      <label>Name</label>
      <input
        class="name-in"
        :value="wallet.address ? shortAddr(wallet.address) : 'Anonymous'"
        disabled
      />
      <label style="margin-left: 8px">Replying to</label>
      <input class="subj-in" :value="`No.${threadId}`" disabled />
    </div>
    <textarea
      ref="ta"
      v-model="body"
      :placeholder="`Start a line with > for greentext.\nUse >>${firstPostId ?? '101'} to quote another post.`"
      maxlength="4000"
      :disabled="submitting"
    />
    <div class="foot">
      <span class="gas">~192k gas · CID pinned to IPFS via Pinata</span>
      <span class="spacer" />
      <button type="button" class="btn" @click="clear" :disabled="submitting">
        Clear
      </button>
      <button
        type="submit"
        class="btn-primary"
        :disabled="!wallet.address || !body.trim() || submitting"
      >
        {{ submitting ? "Signing…" : "Sign & post" }}
      </button>
    </div>
    <div v-if="error" class="error" style="margin: 6px 0 0">{{ error }}</div>
    <div v-if="successTx" class="success" style="margin: 6px 0 0">
      Reply mined.
      <a :href="explorerUrl(successTx)" target="_blank" rel="noopener"
        >View tx</a
      >
    </div>
  </form>
</template>
