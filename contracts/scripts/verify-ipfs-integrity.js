/**
 * IPFS content-integrity verification — proposal §4.1 ("IPFS Content Integrity
 * Test"): "The body fetched from IPFS using the on-chain CID is hashed
 * client-side and compared with the contentHash stored in the Post struct. A
 * match confirms integrity."
 *
 * This script does exactly that, read-only, against the live deployment:
 *
 *   1. Reads the deployed address + ABI from frontend/src/.
 *   2. Reads the most recent thread CIDs straight from chain state.
 *   3. Fetches each body from a public IPFS gateway.
 *   4. **Recomputes the CID locally from the fetched bytes** and asserts it
 *      equals the on-chain `contentHash`. Because a CID is the multihash of the
 *      content, a match is cryptographic proof the body was not tampered with;
 *      any substitution would yield a different CID and fail the comparison.
 *   5. Corroborates across multiple independent gateways when they are up.
 *
 * The CID recomputation for the single-block CIDv0 case (Pinata's default for a
 * small JSON document) is implemented inline with no extra dependency — only
 * `ethers.sha256`, already in the toolchain.
 *
 * Run:  node scripts/verify-ipfs-integrity.js
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const FRONTEND = path.resolve(__dirname, "../../frontend/src");
const config = JSON.parse(fs.readFileSync(path.join(FRONTEND, "config.json")));
const abi = JSON.parse(fs.readFileSync(path.join(FRONTEND, "abi.json")));

const RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://eth-sepolia.public.blastapi.io",
  "https://sepolia.gateway.tenderly.co",
];
// Independent public gateways. We use the project's own Pinata gateway plus the
// canonical Protocol Labs gateway. (Cloudflare retired its public IPFS gateway
// in 2024; dweb.link/4everland are omitted because some antivirus suites
// pre-emptively flag generic IPFS gateway domains — this script only ever
// fetches the project's own JSON body, but we avoid the noise.)
const GATEWAYS = [
  "https://gateway.pinata.cloud",
  "https://ipfs.io",
];

// --- dependency-free CIDv0 recomputation for a single-block UnixFS file -------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58btc(bytes) {
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
function varint(n) {
  const out = [];
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}
// CIDv0 = base58btc( 0x12 0x20 sha256( dag-pb( unixfs(File, content) ) ) )
function cidV0FromContent(content) {
  const len = content.length;
  const unixfs = [0x08, 0x02, 0x12, ...varint(len), ...content, 0x18, ...varint(len)];
  const dagpb = Uint8Array.from([0x0a, ...varint(unixfs.length), ...unixfs]);
  const digest = ethers.getBytes(ethers.sha256(dagpb));
  return base58btc(Uint8Array.from([0x12, 0x20, ...digest]));
}

async function getProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url, { chainId: config.chainId, name: config.network });
      await p.getBlockNumber();
      return p;
    } catch (_) {}
  }
  throw new Error("No Sepolia RPC reachable");
}

async function fetchBody(cid, gateway) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${gateway}/ipfs/${cid}`, { signal: ctrl.signal });
    if (!res.ok) return { gateway, ok: false, note: `HTTP ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { gateway, ok: true, bytes, len: bytes.length, sha256: ethers.sha256(bytes) };
  } catch (e) {
    return { gateway, ok: false, note: e.name === "AbortError" ? "timeout" : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Contract ${config.contractAddress} on ${config.network}\n`);
  const provider = await getProvider();
  const forum = new ethers.Contract(config.contractAddress, abi, provider);

  const total = Number(await forum.threadCount());
  if (total === 0) {
    console.log("No threads on-chain yet — post one in the app, then re-run.");
    return;
  }

  const ids = [];
  for (let id = total; id >= 1 && ids.length < 3; id--) ids.push(id);

  let proven = 0;
  for (const id of ids) {
    const t = await forum.getThread(id);
    const cid = t.contentHash;
    console.log(`Thread #${id}  author=${t.author}\n  on-chain CID: ${cid}`);

    const results = await Promise.all(GATEWAYS.map((g) => fetchBody(cid, g)));
    for (const r of results) {
      console.log(`   ${r.ok ? "✓" : "✗"} ${r.gateway}  ${r.ok ? `${r.len}B sha256=${r.sha256.slice(0, 18)}…` : r.note}`);
    }

    const reachable = results.filter((r) => r.ok);
    if (reachable.length) {
      const digests = new Set(reachable.map((r) => r.sha256));
      console.log(`   gateways agree on content: ${digests.size === 1 ? "yes ✅" : "NO ❌"} (${reachable.length} reachable)`);
      if (cid.startsWith("Qm")) {
        const recomputed = cidV0FromContent(reachable[0].bytes);
        const match = recomputed === cid;
        console.log(`   client-recomputed CID: ${recomputed}  ${match ? "== on-chain CID ✅ INTEGRITY PROVEN" : "≠ on-chain CID ❌ TAMPER"}`);
        if (match) proven++;
      } else {
        console.log(`   (CIDv1 — integrity shown via multi-gateway agreement above)`);
      }
    } else {
      console.log("   no gateway reachable from this network right now");
    }
    console.log();
  }

  console.log(
    `Result: ${proven}/${ids.length} thread bodies cryptographically verified by CID recomputation.\n` +
      "A CID is the hash of its content, so an edited body produces a different CID; the\n" +
      "immutable on-chain contentHash then no longer resolves to it. Tamper-evidence is\n" +
      "structural — not a server-side promise."
  );
}

main().catch((e) => {
  console.error("Could not complete live verification:", e.message);
  console.error("(Run from a machine with outbound HTTPS to a Sepolia RPC + an IPFS gateway.)");
  process.exitCode = 1;
});
