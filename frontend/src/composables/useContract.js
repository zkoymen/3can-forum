import { ref, computed, markRaw } from "vue";
import { Contract, JsonRpcProvider } from "ethers";
import { useWalletStore } from "../stores/wallet";
import abi from "../abi.json";
import config from "../config.json";

// Multiple public Sepolia RPCs. If one cold-starts / rate-limits / CORS-fails,
// rotateReadProvider() advances to the next.
const FALLBACK_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://eth-sepolia.public.blastapi.io",
  "https://sepolia.gateway.tenderly.co",
];

const rpcGen = ref(0); // bump to invalidate any computed that read getReadProvider()
let rpcIndex = 0;
let readProvider = null;

function getReadProvider() {
  // Touch rpcGen so any computed using us re-evaluates after rotateReadProvider.
  // eslint-disable-next-line no-unused-expressions
  rpcGen.value;
  if (!readProvider) {
    readProvider = markRaw(new JsonRpcProvider(FALLBACK_RPCS[rpcIndex]));
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

  // Read-only contract — works whether the wallet is connected or not.
  // markRaw prevents Vue/Pinia from proxying ethers instances, which would
  // break access to ethers v6 private (#) fields.
  const readContract = computed(() => {
    const provider = wallet.provider || getReadProvider();
    return markRaw(new Contract(config.contractAddress, abi, provider));
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
