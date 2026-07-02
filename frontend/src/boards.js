// Canonical board list — the single source of truth for the whole app.
//
// The deployed Forum.sol stores only an IPFS CID per thread (no board field, and
// it's immutable), so a thread's board lives in its pinned JSON payload under
// `board`. New threads carry a valid slug from this list; older threads created
// before boards existed have no board and only ever surface on the "all" view.
export const BOARDS = [
  { slug: "g", name: "tech & code" },
  { slug: "d", name: "design" },
  { slug: "w3", name: "web3 & wallets" },
  { slug: "a", name: "art & media" },
  { slug: "p", name: "philosophy" },
  { slug: "r", name: "random" },
  { slug: "movie", name: "movie" },
  { slug: "book", name: "book" },
  { slug: "game", name: "game" },
];

const BY_SLUG = new Map(BOARDS.map((b) => [b.slug, b]));

// Where a new thread lands when nothing else is chosen.
export const DEFAULT_BOARD = "r";

export function boardBySlug(slug) {
  return BY_SLUG.get(slug) || null;
}

// Coerce an arbitrary value (URL param, IPFS field) to a known slug, or "" if
// it isn't one of our boards. "" means "no/unknown board" — the all view.
export function normalizeBoard(value) {
  if (typeof value !== "string") return "";
  const s = value.trim().toLowerCase();
  return BY_SLUG.has(s) ? s : "";
}
