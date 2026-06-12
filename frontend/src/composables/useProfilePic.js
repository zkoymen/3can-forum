import { ref } from "vue";

/**
 * Local-only mapping of address → IPFS CID for a profile picture.
 * The contract has no on-chain avatar field, so we persist in localStorage.
 * Other visitors won't see your picture unless we eventually sync via an
 * on-chain event, but YOU see your own and you can also export the JSON.
 */
const STORAGE_KEY = "3can-profile-pics-v1";

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(m) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // ignore quota / privacy mode
  }
}

const _map = ref(readMap());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) _map.value = readMap();
  });
}

const PINATA_GATEWAY =
  import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

export function useProfilePic() {
  function getCid(address) {
    if (!address) return null;
    return _map.value[address.toLowerCase()] || null;
  }

  function getUrl(address) {
    const cid = getCid(address);
    if (!cid) return null;
    if (cid.startsWith("data:")) return cid;
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }

  function set(address, cidOrDataUrl) {
    if (!address) return;
    const next = { ..._map.value, [address.toLowerCase()]: cidOrDataUrl };
    _map.value = next;
    writeMap(next);
  }

  function clear(address) {
    if (!address) return;
    const next = { ..._map.value };
    delete next[address.toLowerCase()];
    _map.value = next;
    writeMap(next);
  }

  return { getCid, getUrl, set, clear, map: _map };
}
