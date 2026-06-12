import { defineStore } from "pinia";
import { markRaw } from "vue";
import { BrowserProvider, formatEther } from "ethers";
import config from "../config.json";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const SEPOLIA_CHAIN_ID = 11155111;

export const useWalletStore = defineStore("wallet", {
  state: () => ({
    address: null,
    chainId: null,
    provider: null,
    signer: null,
    error: null,
    connecting: false,
    balance: null,
  }),
  getters: {
    isConnected: (s) => !!s.address,
    isOnSepolia: (s) => s.chainId === SEPOLIA_CHAIN_ID,
    needsContractDeploy: () =>
      config.contractAddress ===
      "0x0000000000000000000000000000000000000000",
    hasMetaMask: () => typeof window !== "undefined" && !!window.ethereum,
  },
  actions: {
    async init() {
      if (!window.ethereum) return;
      window.ethereum.on?.("accountsChanged", (accounts) => {
        if (accounts.length === 0) this.disconnect();
        else this.address = accounts[0];
      });
      window.ethereum.on?.("chainChanged", () => {
        window.location.reload();
      });

      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          await this.connect();
        }
      } catch (e) {
        // ignore
      }
    },

    async connect() {
      this.error = null;
      this.connecting = true;
      try {
        if (!window.ethereum) {
          throw new Error(
            "MetaMask not detected. Install it from https://metamask.io"
          );
        }

        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts authorised in MetaMask.");
        }

        // markRaw: stop Pinia/Vue from proxying ethers instances. The proxy
        // breaks access to ethers v6 private (#) fields and throws
        // "Cannot access private method".
        const provider = markRaw(new BrowserProvider(window.ethereum));
        const net = await provider.getNetwork();
        this.provider = provider;
        this.address = accounts[0];
        this.chainId = Number(net.chainId);

        if (this.chainId !== SEPOLIA_CHAIN_ID) {
          await this.switchToSepolia();
        } else {
          this.signer = markRaw(await provider.getSigner());
          this.refreshBalance().catch(() => {});
        }
      } catch (e) {
        this.error = friendlyError(e);
      } finally {
        this.connecting = false;
      }
    },

    async refreshBalance() {
      if (!this.provider || !this.address) {
        this.balance = null;
        return;
      }
      try {
        const wei = await this.provider.getBalance(this.address);
        this.balance = formatEther(wei);
      } catch {
        this.balance = null;
      }
    },

    async switchToSepolia() {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
        });
      } catch (e) {
        if (e.code === 4902 || /Unrecognized chain/i.test(e?.message || "")) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia",
                nativeCurrency: {
                  name: "Sepolia ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://sepolia.publicnode.com"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } else {
          throw e;
        }
      }
    },

    disconnect() {
      this.address = null;
      this.signer = null;
      this.chainId = null;
      this.provider = null;
      this.balance = null;
    },

    dismissError() {
      this.error = null;
    },
  },
});

function friendlyError(e) {
  if (!e) return "Unknown error";
  if (e.code === 4001) return "Connection rejected in MetaMask.";
  if (e.code === -32002) return "MetaMask request already pending. Open MetaMask.";
  return e.shortMessage || e.message || String(e);
}
