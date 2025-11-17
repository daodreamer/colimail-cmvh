import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHVerifier (non-upgradeable)
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts --network arbitrumSepolia
 */
export default buildModule("CMVHVerifier", (m) => {
  const owner = m.getParameter("owner", m.getAccount(0));

  const verifier = m.contract("CMVHVerifier", [owner]);

  return { verifier };
});
