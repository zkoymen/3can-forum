const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_GATEWAY =
  import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

// cloudflare-ipfs.com was shut down in 2024 — keeping it here made every body
// fetch hang on a dead host before falling through. dweb.link (Protocol Labs)
// and ipfs.io are live fallbacks behind the Pinata gateway.
const PUBLIC_GATEWAYS = [
  PINATA_GATEWAY,
  "https://dweb.link",
  "https://ipfs.io",
];

// Don't let a slow/unresponsive gateway stall the UI — bail and try the next.
const GATEWAY_TIMEOUT_MS = 6000;
// One retry after a short pause when EVERY gateway fails at once — the public
// gateways throttle under burst (a thread mounts N post bodies simultaneously),
// which used to surface as a permanent "IPFS body unreachable" that only a
// manual refresh fixed. A single delayed retry clears the transient throttle.
const RETRY_DELAY_MS = 800;

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { method: "GET", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function useIpfs() {
  async function upload(json) {
    if (!PINATA_JWT) {
      throw new Error(
        "VITE_PINATA_JWT is not set. Create one at https://app.pinata.cloud and add it to .env.local."
      );
    }
    const res = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: json,
          pinataMetadata: { name: `3can-${Date.now()}` },
        }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pinata upload failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.IpfsHash;
  }

  // Race every gateway at once and take the first that answers, instead of
  // waiting out each one's timeout in sequence. Sequential meant a slow/throttled
  // lead gateway (the shared pinata one) blocked the body for up to 6s before the
  // faster fallbacks were even tried; racing returns as soon as the quickest
  // healthy gateway responds.
  async function raceGateways(cid) {
    const attempts = PUBLIC_GATEWAYS.map(async (gateway) => {
      const res = await fetchWithTimeout(`${gateway}/ipfs/${cid}`, GATEWAY_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Gateway ${gateway} returned ${res.status}`);
      return await res.json();
    });
    return Promise.any(attempts);
  }

  async function fetchJson(cid) {
    try {
      return await raceGateways(cid);
    } catch {
      // Every gateway failed together — almost always a transient burst throttle.
      // Pause briefly and try one more full round before giving up.
      await sleep(RETRY_DELAY_MS);
      try {
        return await raceGateways(cid);
      } catch (e) {
        const err = e?.errors?.[0] || e;
        throw err instanceof Error ? err : new Error(`Failed to fetch CID ${cid}`);
      }
    }
  }

  function gatewayUrl(cid) {
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }

  return { upload, fetchJson, gatewayUrl };
}
