import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * CMVHVerifier Deployment Module
 *
 * This module deploys the CMVHVerifier contract using Hardhat Ignition.
 *
 * Usage:
 * - Local deployment: npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts
 * - Testnet: npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts --network arbitrumSepolia
 * - Mainnet: npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts --network arbitrum
 */
export default buildModule("CMVHVerifierModule", (m) => {
  // Deploy CMVHVerifier contract
  const verifier = m.contract("CMVHVerifier", [], {
    // No constructor arguments needed
  });

  // Return deployed contract instance
  return { verifier };
});
