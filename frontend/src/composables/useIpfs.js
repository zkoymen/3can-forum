const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_GATEWAY =
  import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

const PUBLIC_GATEWAYS = [
  PINATA_GATEWAY,
  "https://cloudflare-ipfs.com",
  "https://ipfs.io",
];

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

  async function fetchJson(cid) {
    let lastErr = null;
    for (const gateway of PUBLIC_GATEWAYS) {
      try {
        const url = `${gateway}/ipfs/${cid}`;
        const res = await fetch(url, { method: "GET" });
        if (res.ok) {
          return await res.json();
        }
        lastErr = new Error(`Gateway ${gateway} returned ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error(`Failed to fetch CID ${cid}`);
  }

  function gatewayUrl(cid) {
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }

  return { upload, fetchJson, gatewayUrl };
}
