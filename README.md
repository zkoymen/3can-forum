# 3Can — Decentralised Forum

A minimal, fully decentralised forum: threads, posts, and upvotes recorded
on Ethereum (Sepolia testnet) with post bodies pinned to IPFS via Pinata.
The Vue 3 frontend reads on-chain events directly via `contract.queryFilter`
— no backend, no database.

Course project for **COM4532 — Blockchain Technologies**.

## Live Resources

| | |
|---|---|
| **Live app** | https://frontend-tau-lovat-72.vercel.app (auto-deploys from `main`) |
| **Smart contract** | [`0x3b5b9638151817563abb8e6DE7AA318549eCf921`](https://sepolia.etherscan.io/address/0x3b5b9638151817563abb8e6DE7AA318549eCf921#code) (verified) |
| **Network** | Sepolia testnet (chainId 11155111) |

## Stack

Solidity 0.8.24 · Hardhat 2 · Vue 3 · Vite 5 · ethers v6 · Pinia · Vue Router 4 · Pinata IPFS · Vercel

## Run It Yourself

You need your own credentials — none are stored in this repo. They are all free.

**Prerequisites:** Node.js 18+, MetaMask, a small amount of Sepolia ETH ([Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)).

**1. Clone + install**

```bash
git clone https://github.com/zkoymen/3can-forum.git
cd 3can-forum
cd contracts && npm install
cd ../frontend && npm install
```

**2. Get a Pinata JWT** — sign up at [app.pinata.cloud](https://app.pinata.cloud), create an API key with `pinFileToIPFS` + `pinJSONToIPFS` perms, copy the JWT.

**3. Configure the frontend**

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local — paste your Pinata JWT into VITE_PINATA_JWT
npm run dev
```

Open `http://localhost:5173`. The app is wired to the already-deployed contract at `0x3b5b9638…eCf921` on Sepolia, so anything you post is **visible to everyone using the same contract**.

**4. (Optional) Deploy your own contract**

Only needed if you want an isolated forum. Otherwise skip.

```bash
cd contracts
cp .env.example .env
# Edit .env with: SEPOLIA_RPC_URL (Alchemy/Infura free tier),
# PRIVATE_KEY (a throwaway MetaMask account, funded with Sepolia ETH),
# ETHERSCAN_API_KEY (free from etherscan.io/myapikey)
npm test                  # 10 tests should pass
npm run deploy:sepolia    # auto-writes new address into frontend/src/config.json
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```

The deploy script automatically updates `frontend/src/config.json` and `frontend/src/abi.json`, so the frontend picks up your new contract on next dev-server reload.

## Architecture

```
Browser (Vue 3 + ethers v6)
  ├── MetaMask  ─────────►  Sepolia ─── Forum.sol  (auth + writes)
  ├── JsonRpcProvider ────►  Sepolia public RPC    (reads, even pre-connect)
  └── fetch ──────────────►  Pinata REST           (upload + gateway read)
```

The browser uses `contract.queryFilter` on indexed events
(`ThreadCreated`, `PostCreated`, `PostVoted`) to reconstruct the full
forum state. No off-chain server.

## Scope Note vs Original Proposal

The original proposal described a Spring Boot +
PostgreSQL indexer providing a REST API for the Vue frontend. In
implementation we replaced that layer with direct `eth_getLogs` event
queries from the browser via ethers.js. The semantic effect is identical
— events are the canonical source of truth in both designs — and
removing the intermediate service strengthens the decentralisation
argument made in the proposal: there is no off-chain server whose
failure could disrupt access to historical state. For production loads,
the proposed indexer remains a valid optimisation and is captured under
proposal §3.5 (future work).
