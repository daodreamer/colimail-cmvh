import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

/**
 * Alternative Hardhat configuration with maximum stack optimization
 * Use this if the default config still has stack issues
 *
 * To use: rename to hardhat.config.ts
 */
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000, // Maximum optimization for stack depth
        details: {
          // Enable all safe optimizations
          peephole: true,
          inliner: true,
          jumpdestRemover: true,
          orderLiterals: true,
          deduplicate: true,
          cse: true,
          constantOptimizer: true,
          // Yul optimizer settings
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf[xa[r]scLMcCTUtTOntnfDIulLculVcul[j]Tpeulxa[rul]xa[r]cLgvifCTUca[r]LSsTOtfDnca[r]Iulc]jmul[jul]VcTOcul jmul"
          }
        }
      },
      viaIR: true,
      evmVersion: "shanghai",
      // Additional metadata settings for size optimization
      metadata: {
        bytecodeHash: "none"
      }
    },
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
