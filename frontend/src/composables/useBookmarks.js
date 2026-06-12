import { ref, computed } from "vue";

const STORAGE_KEY = "3can-bookmarks-v1";

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

function write(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // quota / privacy mode — silently ignore
  }
}

const _ids = ref(read());
const _set = computed(() => new Set(_ids.value));

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) _ids.value = read();
  });
}

export function useBookmarks() {
  function add(threadId) {
    const id = String(threadId);
    if (_set.value.has(id)) return;
    _ids.value = [..._ids.value, id];
    write(_ids.value);
  }
  function remove(threadId) {
    const id = String(threadId);
    if (!_set.value.has(id)) return;
    _ids.value = _ids.value.filter((x) => x !== id);
    write(_ids.value);
  }
  function toggle(threadId) {
    if (_set.value.has(String(threadId))) remove(threadId);
    else add(threadId);
  }
  function has(threadId) {
    return _set.value.has(String(threadId));
  }
  return { ids: _ids, has, add, remove, toggle };
}
