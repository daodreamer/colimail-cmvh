import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHVerifier with UUPS proxy pattern
 *
 * Deployment Flow:
 * 1. Deploy CMVHVerifier implementation contract
 * 2. Encode initialize(initialOwner) function call
 * 3. Deploy ERC1967Proxy pointing to implementation with initialization data
 * 4. Return proxy instance as CMVHVerifier
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts --network arbitrumSepolia
 *
 * Upgrade:
 * Use CMVHVerifier_upgrade.ts module after initial deployment
 *
 * Note: Module ID changed from "CMVHVerifier" to "CMVHVerifier_UUPS" to avoid
 * conflicts with previous non-upgradeable deployments.
 */
export default buildModule("CMVHVerifier_UUPS", (m) => {
  // Get initial owner parameter (defaults to deployer account)
  const owner = m.getParameter("owner", m.getAccount(0));

  // Step 1: Deploy implementation contract
  const implementation = m.contract("CMVHVerifier");

  // Step 2: Encode initialize function call
  // initialize(address initialOwner)
  const initializeCalldata = m.encodeFunctionCall(implementation, "initialize", [owner]);

  // Step 3: Deploy ERC1967Proxy with implementation address and initialization data
  const proxy = m.contract("ERC1967ProxyWrapper", [implementation, initializeCalldata], {
    id: "CMVHVerifier_Proxy"
  });

  // Step 4: Return proxy instance cast to CMVHVerifier interface
  // This allows calling CMVHVerifier functions through the proxy
  const verifier = m.contractAt("CMVHVerifier", proxy, {
    id: "CMVHVerifier_ProxyInstance"
  });

  return {
    implementation,
    proxy,
    verifier
  };
});
