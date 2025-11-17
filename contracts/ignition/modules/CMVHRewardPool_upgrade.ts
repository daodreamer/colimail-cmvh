import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for upgrading CMVHRewardPool UUPS proxy
 *
 * This module:
 * 1. Deploys new CMVHRewardPool implementation
 * 2. Calls upgradeToAndCall on existing proxy
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHRewardPool_upgrade.ts \
 *   --network arbitrumSepolia \
 *   --parameters '{"CMVHRewardPool_Upgrade":{"proxyAddress":"0x..."}}'
 *
 * Or use default proxy address (deployed on ArbitrumSepolia):
 * npx hardhat ignition deploy ignition/modules/CMVHRewardPool_upgrade.ts \
 *   --network arbitrumSepolia
 *
 * IMPORTANT: Storage Layout Compatibility
 * - State variables MUST maintain same order and types
 * - New variables should be added at the END
 * - Cannot remove or change existing variables
 * - Cannot change inheritance order
 *
 * Security:
 * - Only contract owner can authorize upgrades (_authorizeUpgrade)
 * - Test upgrade on testnet before mainnet
 * - Verify new implementation contract after deployment
 */
export default buildModule("CMVHRewardPool_Upgrade", (m) => {
  // Default proxy address (update this after first deployment)
  const DEFAULT_PROXY_ADDRESS = "0x60fE7D46D3120bE671FE4C4fe45065e8f181B8eF";

  // Get proxy address from parameters or use default
  const proxyAddress = m.getParameter<string>("proxyAddress", DEFAULT_PROXY_ADDRESS) as string;

  // Step 1: Deploy new implementation contract
  const newImplementation = m.contract("CMVHRewardPool", [], {
    id: "CMVHRewardPool_NewImplementation"
  });

  // Step 2: Get existing proxy instance
  const proxy = m.contractAt("CMVHRewardPool", proxyAddress, {
    id: "CMVHRewardPool_ExistingProxy"
  });

  // Step 3: Upgrade proxy to new implementation
  // upgradeToAndCall(address newImplementation, bytes memory data)
  // Empty data means no additional initialization on upgrade
  const upgradeData = "0x";
  m.call(proxy, "upgradeToAndCall", [newImplementation, upgradeData], {
    id: "CMVHRewardPool_UpgradeCall"
  });

  return { proxyAddress, newImplementation, proxy };
});
