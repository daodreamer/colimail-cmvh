import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHRewardPoolV1 UUPS proxy
 *
 * This module requires the verifier proxy address to be passed as a parameter.
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHRewardPool.ts \
 *   --network arbitrumSepolia \
 *   --parameters ignition/parameters/arbitrumSepolia.json
 */
export default buildModule("CMVHRewardPool", (m) => {
  // Required parameters
  const wactToken = m.getParameter("wactToken", "0x24De878d1af185A2Bd7Fd45D53180d15d4663F37");
  const verifierProxy = m.getParameter("verifierProxy"); // Must be provided
  const owner = m.getParameter("owner", m.getAccount(0));
  const feeCollector = m.getParameter("feeCollector", m.getAccount(0));

  // Deploy implementation contract
  const rewardPoolImpl = m.contract("CMVHRewardPoolV1");

  // Deploy proxy with empty initialization data
  const rewardPoolProxy = m.contract("ERC1967Proxy", [rewardPoolImpl, "0x"], {
    id: "RewardPoolProxy"
  });

  // Get proxy as CMVHRewardPoolV1 interface
  const proxiedRewardPool = m.contractAt("CMVHRewardPoolV1", rewardPoolProxy);

  // Initialize through proxy
  m.call(proxiedRewardPool, "initialize", [
    wactToken,
    verifierProxy,
    feeCollector,
    owner,
  ]);

  // Return proxy address
  return { rewardPoolProxy, proxiedRewardPool };
});
