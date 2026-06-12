import { markRaw } from "vue";
import { JsonRpcProvider, getAddress } from "ethers";

/**
 * ENS reverse-lookup. ENS is mainnet-only — even when the user is connected
 * to Sepolia, their address may have an ENS name registered on mainnet,
 * which is what we want to display ("vitalik.eth" instead of "0x...").
 *
 * Results are cached for the lifetime of the page; misses (no ENS) are also
 * cached so we don't refetch on every render.
 */
const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";

let _provider = null;
function provider() {
  if (!_provider) _provider = markRaw(new JsonRpcProvider(MAINNET_RPC));
  return _provider;
}

const cache = new Map(); // checksummed address -> ensName | null
const inflight = new Map(); // checksummed address -> Promise

export function useEns() {
  async function lookup(address) {
    if (!address) return null;
    let key;
    try {
      key = getAddress(address);
    } catch {
      return null;
    }
    if (cache.has(key)) return cache.get(key);
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
      try {
        const name = await provider().lookupAddress(key);
        cache.set(key, name);
        return name;
      } catch {
        cache.set(key, null);
        return null;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  }

  return { lookup };
}
