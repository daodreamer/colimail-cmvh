import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHVerifierV1 UUPS proxy
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHVerifier.ts --network arbitrumSepolia
 */
export default buildModule("CMVHVerifier", (m) => {
  // Get owner address (defaults to first account)
  const owner = m.getParameter("owner", m.getAccount(0));

  // Deploy implementation contract
  const verifierImpl = m.contract("CMVHVerifierV1");

  // Deploy proxy with empty initialization data
  const verifierProxy = m.contract("ERC1967Proxy", [verifierImpl, "0x"], {
    id: "VerifierProxy"
  });

  // Get proxy as CMVHVerifierV1 interface
  const proxiedVerifier = m.contractAt("CMVHVerifierV1", verifierProxy);

  // Initialize through proxy
  m.call(proxiedVerifier, "initialize", [owner]);

  // Return proxy address for use in other modules
  return { verifierProxy, proxiedVerifier };
});
