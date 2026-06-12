<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useWalletStore } from "../stores/wallet";
import { useProfilePic } from "../composables/useProfilePic";
import { useBookmarks } from "../composables/useBookmarks";
import { useNotifications } from "../composables/useNotifications";
import { useIpfs } from "../composables/useIpfs";
import Identicon from "../components/Identicon.vue";
import { shortAddr } from "../utils/format";

const router = useRouter();
const wallet = useWalletStore();
const profilePic = useProfilePic();
const bookmarks = useBookmarks();
const notif = useNotifications();
const ipfs = useIpfs();

const uploading = ref(false);
const uploadError = ref(null);
const uploadOk = ref(false);
const fileInput = ref(null);

const currentPicUrl = computed(() =>
  wallet.address ? profilePic.getUrl(wallet.address) : null
);

function back() {
  if (window.history.length > 1) router.back();
  else router.push("/");
}

const canGoBack = computed(() => window.history.length > 1);

function dataUrlFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file || !wallet.address) return;
  if (!file.type.startsWith("image/")) {
    uploadError.value = "Please choose an image file (PNG, JPG, GIF).";
    return;
  }
  if (file.size > 512 * 1024) {
    uploadError.value =
      "Image too large (max 512 KB). Pick a smaller file or crop it first.";
    return;
  }
  uploading.value = true;
  uploadError.value = null;
  uploadOk.value = false;
  try {
    // Try IPFS upload first; fall back to a local data URL if Pinata fails.
    let stored;
    try {
      const dataUrl = await dataUrlFromFile(file);
      const cid = await ipfs.upload({
        kind: "avatar",
        address: wallet.address,
        dataUrl,
        createdAt: new Date().toISOString(),
      });
      stored = cid;
    } catch (ipfsErr) {
      stored = await dataUrlFromFile(file);
    }
    profilePic.set(wallet.address, stored);
    uploadOk.value = true;
  } catch (err) {
    uploadError.value = err.message || String(err);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

function removePic() {
  if (!wallet.address) return;
  profilePic.clear(wallet.address);
  uploadOk.value = false;
}

function clearBookmarks() {
  if (
    !window.confirm(
      `Remove all ${bookmarks.ids.value.length} bookmark(s)? This can't be undone.`
    )
  ) {
    return;
  }
  const all = [...bookmarks.ids.value];
  all.forEach((id) => bookmarks.remove(id));
}

async function requestNotif() {
  await notif.request();
}
</script>

<template>
  <a class="back-link" href="#" @click.prevent="back" v-if="canGoBack">
    <span class="arr">←</span> Back
  </a>

  <div class="crumb-bar">
    <a href="#" @click.prevent="router.push('/')">/3can/</a>
    <span class="sep">›</span>
    <span>settings</span>
  </div>

  <h1
    style="font-family: var(--f-serif); font-size: 22px; color: var(--red); margin: 6px 0 12px"
  >
    Settings
  </h1>

  <!-- Profile picture -->
  <section class="panel" style="margin-bottom: 12px">
    <div class="panel-head">Profile picture</div>
    <div class="panel-body" style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap">
      <div style="display: flex; align-items: center; gap: 10px">
        <img
          v-if="currentPicUrl"
          :src="currentPicUrl"
          class="avatar-preview"
          alt=""
        />
        <Identicon
          v-else-if="wallet.address"
          :address="wallet.address"
          :size="56"
        />
        <div
          v-else
          class="muted"
          style="font-size: 11px; max-width: 200px"
        >
          Connect a wallet first to manage your profile picture.
        </div>
      </div>

      <div style="flex: 1; min-width: 220px">
        <div class="muted" style="font-size: 11px; margin-bottom: 6px">
          Pinned to IPFS via Pinata when possible; otherwise stored locally in your browser.
          Other visitors using a different browser won't see it yet (that needs an on-chain field).
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          @change="onFileChange"
          :disabled="!wallet.address || uploading"
          style="font-size: 11.5px"
        />
        <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap">
          <button
            class="btn"
            type="button"
            :disabled="!currentPicUrl"
            @click="removePic"
          >
            Remove
          </button>
          <span v-if="uploading" class="muted">Uploading…</span>
          <span v-if="uploadOk" class="success" style="padding: 0 6px; margin: 0">
            Saved.
          </span>
        </div>
        <div v-if="uploadError" class="error" style="margin-top: 6px">
          {{ uploadError }}
        </div>
      </div>
    </div>
  </section>

  <!-- Notifications -->
  <section class="panel" style="margin-bottom: 12px">
    <div class="panel-head">Notifications</div>
    <div class="panel-body" style="display: grid; gap: 6px">
      <div class="muted" style="font-size: 11px">
        Get a browser notification when someone replies to one of your
        bookmarked threads. Requires permission from your browser.
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap">
        <span class="mono" style="font-size: 11px">
          status:
          <b>{{ notif.supported ? notif.permission.value : "unsupported" }}</b>
        </span>
        <button
          v-if="notif.supported && notif.permission.value === 'default'"
          class="btn-primary"
          @click="requestNotif"
        >
          Enable notifications
        </button>
        <span
          v-else-if="notif.permission.value === 'denied'"
          class="muted"
          style="font-size: 11px"
        >
          Denied — re-enable from your browser's site permissions.
        </span>
      </div>
    </div>
  </section>

  <!-- Bookmarks -->
  <section class="panel" style="margin-bottom: 12px">
    <div class="panel-head">Bookmarks</div>
    <div class="panel-body" style="display: grid; gap: 6px">
      <div class="muted" style="font-size: 11px">
        You currently have <b>{{ bookmarks.ids.value.length }}</b> saved
        thread{{ bookmarks.ids.value.length === 1 ? "" : "s" }}.
        Bookmarks live in your browser's localStorage.
      </div>
      <div>
        <button
          class="btn"
          :disabled="bookmarks.ids.value.length === 0"
          @click="clearBookmarks"
        >
          Clear all bookmarks
        </button>
      </div>
    </div>
  </section>

  <!-- Wallet -->
  <section class="panel" style="margin-bottom: 12px">
    <div class="panel-head">Wallet</div>
    <div class="panel-body wallet-card">
      <template v-if="wallet.address">
        <div class="row">
          <Identicon :address="wallet.address" :size="18" />
          <span class="addr">{{ shortAddr(wallet.address) }}</span>
        </div>
        <div class="row">
          <span class="muted">network</span>
          <span class="mono">{{
            wallet.isOnSepolia ? "Sepolia (11155111)" : "wrong network"
          }}</span>
        </div>
        <div class="actions">
          <button
            v-if="!wallet.isOnSepolia"
            class="btn"
            @click="wallet.switchToSepolia()"
          >
            Switch to Sepolia
          </button>
          <button class="btn" @click="wallet.disconnect()">
            Disconnect
          </button>
        </div>
      </template>
      <template v-else>
        <div class="muted">Not connected.</div>
        <div class="actions">
          <button class="btn-primary" @click="wallet.connect()">
            Connect wallet
          </button>
        </div>
      </template>
    </div>
  </section>

  <!-- About -->
  <section class="panel">
    <div class="panel-head">About 3can</div>
    <div class="panel-body" style="font-size: 11.5px; line-height: 1.55">
      <div>
        Three Can is a decentralised forum. Threads and replies live on-chain;
        bodies live on IPFS. There is no admin, no upgrade, no delete button.
      </div>
      <div style="margin-top: 4px">
        <a href="https://github.com/zkoymen/3can-forum" target="_blank" rel="noopener">
          GitHub repo
        </a>
        ·
        <a
          href="https://sepolia.etherscan.io/address/0x3b5b9638151817563abb8e6DE7AA318549eCf921#code"
          target="_blank"
          rel="noopener"
        >
          Verified contract
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.avatar-preview {
  width: 56px;
  height: 56px;
  border: 1px solid var(--rule);
  object-fit: cover;
  display: block;
}
</style>
