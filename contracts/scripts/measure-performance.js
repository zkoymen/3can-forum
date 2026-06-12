/**
 * Read-path performance measurement — the parts of proposal §4.4 that survive
 * the Spring-indexer scope cut.
 *
 *   - Verification latency: a single on-demand getPost() eth_call (§4.4).
 *   - Cold-cache read: full ThreadCreated backfill from deployBlock to head —
 *     the work the home page does on first paint (§4.4 "read latency").
 *
 * The indexer-dependent rows (pagination REST-vs-chain, indexer lag) are N/A by
 * construction and are documented as such in FINAL-REPORT.md rather than faked.
 *
 * Run:  node scripts/measure-performance.js
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
const CHUNK = 49_500;

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
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

async function main() {
  const provider = await getProvider();
  const forum = new ethers.Contract(config.contractAddress, abi, provider);

  // --- Verification latency: 20 sequential getPost calls ---
  const postCount = Number(await forum.postCount());
  if (postCount > 0) {
    const samples = [];
    for (let i = 0; i < 20; i++) {
      const id = (i % postCount) + 1;
      const t0 = performance.now();
      await forum.getPost(id);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    console.log("Verification latency — single getPost() eth_call:");
    console.log(`   p50 ${pct(samples, 50).toFixed(0)} ms · p95 ${pct(samples, 95).toFixed(0)} ms (n=20)`);
  } else {
    console.log("Verification latency: no posts on-chain yet — skipped.");
  }

  // --- Cold-cache read: full ThreadCreated backfill (home-page first paint) ---
  const head = await provider.getBlockNumber();
  const filter = forum.filters.ThreadCreated();
  const t0 = performance.now();
  let from = config.deployBlock;
  let events = 0;
  while (from <= head) {
    const to = Math.min(from + CHUNK - 1, head);
    events += (await forum.queryFilter(filter, from, to)).length;
    from = to + 1;
  }
  const elapsed = performance.now() - t0;
  const blocks = head - config.deployBlock;
  console.log("\nCold-cache read — full ThreadCreated backfill (deployBlock→head):");
  console.log(
    `   ${(elapsed / 1000).toFixed(2)} s for ${events} threads across ${blocks.toLocaleString()} blocks ` +
      `(${Math.ceil(blocks / CHUNK)} chunked eth_getLogs calls).`
  );
  console.log(
    "   Note: this is the upper-bound 'no index' cost the proposed Spring indexer\n" +
      "   would have optimised; the browser pays it once per cold load, then tails live."
  );
}

main().catch((e) => {
  console.error("Could not complete live measurement:", e.message);
  console.error("(Run from a machine with outbound HTTPS to a Sepolia RPC.)");
  process.exitCode = 1;
});
