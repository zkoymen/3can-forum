import { ref } from "vue";
import { formatUnits } from "ethers";
import {
  useContract,
  rotateReadProvider,
  FALLBACK_RPC_COUNT,
} from "./useContract";

const blockNumber = ref(null);
const gasGwei = ref(null);

let _polling = false;

async function tick() {
  const { readContract } = useContract();
  const provider = readContract.value.runner?.provider || readContract.value.runner;
  for (let attempt = 0; attempt < FALLBACK_RPC_COUNT; attempt++) {
    try {
      const [bn, fee] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData().catch(() => null),
      ]);
      blockNumber.value = bn;
      if (fee?.gasPrice) {
        gasGwei.value = Number(formatUnits(fee.gasPrice, "gwei")).toFixed(1);
      }
      return;
    } catch {
      rotateReadProvider();
    }
  }
}

export function useChainMeta() {
  if (!_polling && typeof window !== "undefined") {
    _polling = true;
    tick();
    setInterval(tick, 30000);
  }
  return { blockNumber, gasGwei };
}
