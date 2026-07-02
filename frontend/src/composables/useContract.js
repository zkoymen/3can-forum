import { ref, computed, markRaw } from "vue";
import { Contract, JsonRpcProvider, Network } from "ethers";
import { useWalletStore } from "../stores/wallet";
import abi from "../abi.json";
import config from "../config.json";

// Sepolia, pinned so ethers never re-runs eth_chainId network detection.
const SEPOLIA = Network.from(11155111);

// Read providers, in priority order. tenderly leads because it serves our wide
// eth_getLogs scans across the FULL deploy->head range (which is archive data)
// with no token. A dedicated RPC via VITE_SEPOLIA_RPC_URL goes LAST as a deep
// fallback: the common free tiers (e.g. Alchemy's 10-block getLogs cap) can't
// serve the event scans and only add failover latency on the hot path, so they
// must not lead. rotateReadProvider() advances to the next on a network error.
const ENV_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL;
const FALLBACK_RPCS = [
  "https://sepolia.gateway.tenderly.co", // handles the full deploy->head range
  // publicnode used to lead (50k blocks/getLogs) but now 403s any archive
  // getLogs with "Archive requests require a personal token" — our deploy->head
  // scans are archive, so it can no longer serve the hot path. Kept as a
  // secondary for recent-range/state calls only.
  "https://ethereum-sepolia-rpc.publicnode.com",
  ...(ENV_RPC ? [ENV_RPC] : []), // dedicated RPC: deep fallback only
  // NOTE: eth-sepolia.public.blastapi.io was removed — Blast API shut down and
  // now returns "Blast API is no longer available" for every request.
];

const rpcGen = ref(0); // bump to invalidate any computed that read getReadProvider()
let rpcIndex = 0;
let readProvider = null;

function makeProvider(url) {
  // batchMaxCount:1 disables JSON-RPC request batching. A rate-limited public
  // node answers a batch with a single 429 / HTML body that ethers can't map
  // back to the individual calls — that is the "could not coalesce error".
  // One HTTP request per call sidesteps it entirely. staticNetwork skips the
  // repeated eth_chainId probes.
  //
  // polling:true is critical for live watchers (contract.on). By default ethers
  // uses a server-side filter (eth_newFilter + eth_getFilterChanges). The public
  // RPCs are load-balanced, so the node that answers a getFilterChanges poll
  // usually isn't the one that created the filter → "-32000 filter not found",
  // which ethers surfaces as a NON-STOP "could not coalesce error". polling:true
  // switches to a stateless eth_getLogs poll that works across load-balanced
  // nodes.
  const p = new JsonRpcProvider(url, SEPOLIA, {
    staticNetwork: SEPOLIA,
    batchMaxCount: 1,
    polling: true,
  });
  // Slow the poller from the 4s default to roughly one block time, so open tabs
  // don't hammer the RPC in the background.
  p.pollingInterval = 12_000;
  return markRaw(p);
}

function getReadProvider() {
  // Touch rpcGen so any computed using us re-evaluates after rotateReadProvider.
  // eslint-disable-next-line no-unused-expressions
  rpcGen.value;
  if (!readProvider) {
    readProvider = makeProvider(FALLBACK_RPCS[rpcIndex]);
  }
  return readProvider;
}

export function rotateReadProvider() {
  rpcIndex = (rpcIndex + 1) % FALLBACK_RPCS.length;
  readProvider = null;
  rpcGen.value++;
}

export const FALLBACK_RPC_COUNT = FALLBACK_RPCS.length;

export function useContract() {
  const wallet = useWalletStore();

  // Read-only contract. Always uses the dedicated read provider (not the wallet's
  // injected provider) so the heavy eth_getLogs scans get the reliable RPC and
  // dodge MetaMask's 10k-block getLogs cap. Works connected or not.
  const readContract = computed(() => {
    // eslint-disable-next-line no-unused-expressions
    rpcGen.value; // recompute after a provider rotation
    return markRaw(new Contract(config.contractAddress, abi, getReadProvider()));
  });

  // Write contract — requires a connected signer on Sepolia.
  const writeContract = computed(() => {
    if (!wallet.signer) return null;
    return markRaw(new Contract(config.contractAddress, abi, wallet.signer));
  });

  return {
    readContract,
    writeContract,
    contractAddress: config.contractAddress,
    deployBlock: config.deployBlock,
    chainId: config.chainId,
    explorerUrl: (txHashOrAddress, kind = "tx") =>
      `https://sepolia.etherscan.io/${kind}/${txHashOrAddress}`,
  };
}
