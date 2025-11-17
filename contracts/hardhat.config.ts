import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: false
        },
      },
    ],
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "generic",
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [configVariable("ARBITRUM_SEPOLIA_PRIVATE_KEY")],
    },
    arbitrum: {
      type: "http",
      chainType: "generic",
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [configVariable("ARBITRUM_PRIVATE_KEY")],
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  verify: {
    etherscan: {
      apiKey: "YOUR_ETHERSCAN_API_KEY",
    },
  },
  chainDescriptors: {
        // Arbitrum Sepolia
        421614: {
          name: "Arbitrum Sepolia",
          blockExplorers: {
            etherscan: {
              name: "Arbiscan Sepolia",
              url: "https://sepolia.arbiscan.io",
              apiUrl: "https://api-sepolia.arbiscan.io/api",
            },
          },
        },
    }
});
