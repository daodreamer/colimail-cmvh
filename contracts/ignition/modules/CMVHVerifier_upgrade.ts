import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for upgrading CMVHVerifier UUPS proxy
 *
 * Upgrade Flow (UUPS Pattern):
 * 1. Deploy new implementation contract (CMVHVerifierV2)
 * 2. Call upgradeToAndCall() on the existing proxy through owner
 * 3. Proxy's storage is preserved, only logic is upgraded
 *
 * IMPORTANT:
 * - The proxy address is configured in DEFAULT_PROXY_ADDRESS (line 35)
 * - Only the owner can authorize upgrades (enforced by _authorizeUpgrade)
 * - Storage layout must be compatible with previous version
 *
 * Usage (using default proxy address from script):
 * npx hardhat ignition deploy ignition/modules/CMVHVerifier_upgrade.ts --network arbitrumSepolia
 *
 * Usage (override proxy address via parameter):
 * npx hardhat ignition deploy ignition/modules/CMVHVerifier_upgrade.ts \
 *   --parameters '{"CMVHVerifier_Upgrade":{"proxyAddress":"0x..."}}' \
 *   --network arbitrumSepolia
 *
 * Testing upgrade locally:
 * 1. Deploy initial version with CMVHVerifier.ts
 * 2. Note the proxy address from deployment
 * 3. Modify contract (e.g., add new function, change VERSION)
 * 4. Run this upgrade module with the proxy address
 * 5. Verify storage was preserved and new functions work
 */
export default buildModule("CMVHVerifier_Upgrade", (m) => {
  // Get proxy address parameter
  // Default: Use the deployed proxy address from CMVHVerifier_UUPS deployment
  // Override: Use --parameters flag or modify the default value below
  const DEFAULT_PROXY_ADDRESS = "0x8f7B72f66C3bC42A8ca6207fDAc7ec1a07641F03";

  const proxyAddress = m.getParameter<string>("proxyAddress", DEFAULT_PROXY_ADDRESS) as string;

  if (!proxyAddress || proxyAddress === "") {
    throw new Error(
      "proxyAddress parameter is required. Set DEFAULT_PROXY_ADDRESS in the script or use --parameters flag"
    );
  }

  // Step 1: Deploy new implementation contract
  // NOTE: If you're deploying a new version (e.g., CMVHVerifierV2),
  // change "CMVHVerifier" to "CMVHVerifierV2" below
  const newImplementation = m.contract("CMVHVerifier", [], {
    id: "CMVHVerifier_NewImplementation"
  });

  // Step 2: Get existing proxy instance
  const proxy = m.contractAt("CMVHVerifier", proxyAddress, {
    id: "CMVHVerifier_ExistingProxy"
  });

  // Step 3: Prepare upgrade call
  // For UUPS upgrades, we call upgradeToAndCall on the proxy
  // If you need to run initialization logic during upgrade, encode it here
  // Otherwise, pass empty bytes ("0x")
  const upgradeData = "0x"; // No additional initialization needed

  // Step 4: Execute upgrade
  // upgradeToAndCall(address newImplementation, bytes memory data)
  // This will:
  // 1. Check authorization via _authorizeUpgrade (owner only)
  // 2. Update the implementation address in ERC-1967 storage slot
  // 3. Execute initialization data if provided
  m.call(proxy, "upgradeToAndCall", [newImplementation, upgradeData], {
    id: "CMVHVerifier_UpgradeCall"
  });

  return {
    proxyAddress: proxyAddress,
    newImplementation,
    proxy
  };
});

/**
 * Example: Upgrading to a V2 contract with new storage
 *
 * If you're adding new storage variables in V2, follow these rules:
 * 1. NEVER remove or reorder existing storage variables
 * 2. NEVER change the type of existing storage variables
 * 3. ALWAYS append new variables at the end
 * 4. Use storage gaps for future-proofing
 *
 * Example V2 contract:
 *
 * contract CMVHVerifierV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
 *   // Existing storage from V1 (DO NOT MODIFY)
 *   string public constant NAME = "CMVHVerifier";
 *   string public constant VERSION = "2.1.0"; // Changed version
 *   bytes32 public constant DOMAIN_TYPEHASH = ...;
 *   bytes32 public constant EMAIL_TYPEHASH = ...;
 *
 *   // New storage in V2 (APPEND ONLY)
 *   mapping(bytes32 => uint256) public emailVerificationCount; // New feature
 *   uint256[50] private __gap; // Reserve space for future upgrades
 *
 *   // New function in V2
 *   function getVerificationCount(bytes32 emailHash) external view returns (uint256) {
 *     return emailVerificationCount[emailHash];
 *   }
 * }
 *
 * Then modify this upgrade script:
 * const newImplementation = m.contract("CMVHVerifierV2", [], {
 *   id: "CMVHVerifierV2_NewImplementation"
 * });
 */
