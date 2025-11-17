import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHRewardPool (non-upgradeable)
 *
 * This module requires the verifier address to be passed as a parameter.
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHRewardPool.ts \
 *   --network arbitrumSepolia \
 *   --parameters ignition/parameters/arbitrumSepolia.json
 */
export default buildModule("CMVHRewardPool", (m) => {
  const wactToken = m.getParameter(
    "wactToken",
    "0x24De878d1af185A2Bd7Fd45D53180d15d4663F37"
  );
  const verifier = m.getParameter("verifier", "0x8d0eAbf2064d55810e96666da53E0390f18e728e");
  const owner = m.getParameter("owner", m.getAccount(0));
  const feeCollector = m.getParameter("feeCollector", m.getAccount(0));

  const rewardPool = m.contract("CMVHRewardPool", [
    wactToken,
    verifier,
    feeCollector,
    owner,
  ]);

  return { rewardPool };
});
