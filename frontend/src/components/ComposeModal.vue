<script setup>
import { computed, ref } from "vue";
import { useContract } from "../composables/useContract";
import { useIpfs } from "../composables/useIpfs";
import { useWalletStore } from "../stores/wallet";
import { BOARDS, DEFAULT_BOARD, normalizeBoard } from "../boards";
import { shortAddr } from "../utils/format";

const props = defineProps({
  defaultBoard: { type: String, default: "" }, // preselect when composing from a board page
});
const emit = defineEmits(["close", "created"]);

const { writeContract } = useContract();
const ipfs = useIpfs();
const wallet = useWalletStore();

const boards = BOARDS;
const board = ref(normalizeBoard(props.defaultBoard) || DEFAULT_BOARD);
const title = ref("");
const body = ref("");
const submitting = ref(false);
const error = ref(null);

const ready = computed(
  () => title.value.trim().length > 4 && body.value.trim().length > 4
);

async function submit() {
  if (!ready.value || !wallet.isConnected) return;
  submitting.value = true;
  error.value = null;
  try {
    const payload = {
      title: title.value.trim(),
      body: body.value.trim(),
      board: board.value,
      createdAt: new Date().toISOString(),
      kind: "thread",
    };
    const cid = await ipfs.upload(payload);
    const tx = await writeContract.value.createThread(cid);
    await tx.wait();
    wallet.refreshBalance().catch(() => {});
    emit("created");
  } catch (e) {
    error.value = e.shortMessage || e.message || String(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="scrim" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="title-bar">
        <span>Start a new thread on /{{ board }}/</span>
        <span class="x" @click="emit('close')">×</span>
      </div>
      <div class="modal-body">
        <div class="note">
          posting as
          <b style="font-family: var(--f-mono); color: var(--ink)">{{
            wallet.address ? shortAddr(wallet.address) : "—"
          }}</b>
          · body pins to IPFS · signed into <code>createThread()</code>
        </div>

        <label>Board</label>
        <select class="field" v-model="board" :disabled="submitting">
          <option v-for="b in boards" :key="b.slug" :value="b.slug">
            /{{ b.slug }}/ — {{ b.name }}
          </option>
        </select>

        <label>Subject</label>
        <input
          class="field"
          v-model="title"
          placeholder="thread title (one line)"
          maxlength="140"
          :disabled="submitting"
        />

        <label>Body</label>
        <textarea
          class="field"
          v-model="body"
          rows="6"
          placeholder=">be op&#10;>start thread&#10;>see what happens"
          maxlength="4000"
          :disabled="submitting"
        />

        <div class="note">
          estimated cost: ~165k gas (~0.0033 ETH at 20 gwei) · body uploaded to
          Pinata, returned CID is the only thing stored on-chain.
        </div>

        <div v-if="error" class="error" style="margin: 4px 0">{{ error }}</div>

        <div class="modal-foot">
          <span class="note">CID will be computed after upload.</span>
          <span class="spacer" />
          <button class="btn" @click="emit('close')" :disabled="submitting">
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="!ready || !wallet.isConnected || submitting"
            @click="submit"
          >
            {{ submitting ? "Signing…" : "Sign & broadcast" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
