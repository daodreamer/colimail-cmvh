import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying CMVHRewardPool as UUPS upgradeable proxy
 *
 * This module deploys:
 * 1. CMVHRewardPool implementation contract
 * 2. ERC1967ProxyWrapper pointing to the implementation
 * 3. Returns proxy instance with implementation ABI
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/CMVHRewardPool.ts \
 *   --network arbitrumSepolia \
 *   --parameters ignition/parameters/arbitrumSepolia.json
 *
 * Parameters:
 * - wactToken: wACT token contract address (default: ArbitrumSepolia wACT)
 * - verifier: CMVHVerifier proxy address (default: deployed verifier)
 * - owner: Contract owner address (default: deployer account)
 * - feeCollector: Fee collector address (default: deployer account)
 */
export default buildModule("CMVHRewardPool_UUPS", (m) => {
  // Get deployment parameters
  const wactToken = m.getParameter(
    "wactToken",
    "0x24De878d1af185A2Bd7Fd45D53180d15d4663F37"
  );
  const verifier = m.getParameter("verifier", "0x8f7B72f66C3bC42A8ca6207fDAc7ec1a07641F03");
  const owner = m.getParameter("owner", m.getAccount(0));
  const feeCollector = m.getParameter("feeCollector", m.getAccount(0));

  // Step 1: Deploy implementation contract
  const implementation = m.contract("CMVHRewardPool");

  // Step 2: Encode initialize function call
  // initialize(address _wactToken, address _verifier, address _feeCollector, address initialOwner)
  const initializeCalldata = m.encodeFunctionCall(
    implementation,
    "initialize",
    [wactToken, verifier, feeCollector, owner]
  );

  // Step 3: Deploy ERC1967ProxyWrapper with implementation and initialization data
  const proxy = m.contract("ERC1967ProxyWrapper", [implementation, initializeCalldata], {
    id: "CMVHRewardPool_Proxy"
  });

  // Step 4: Return proxy instance with implementation ABI
  const rewardPool = m.contractAt("CMVHRewardPool", proxy, {
    id: "CMVHRewardPool_ProxyInstance"
  });

  return { implementation, proxy, rewardPool };
});
