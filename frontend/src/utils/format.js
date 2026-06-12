export function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export function shortCid(c) {
  if (!c) return "";
  return c.slice(0, 10) + "…" + c.slice(-4);
}

export function shortTx(t) {
  if (!t) return "";
  return t.slice(0, 8) + "…" + t.slice(-6);
}

export function timeAgo(unixSeconds) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  return d + "d";
}

export function dateStr(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d
    .toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

export function previewBody(text, n) {
  if (!text) return "";
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, "") + "…";
}
