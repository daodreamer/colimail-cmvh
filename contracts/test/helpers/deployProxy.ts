import { encodeFunctionData } from "viem";

/**
 * Helper functions for deploying UUPS proxies in tests
 */

/**
 * Deploy CMVHVerifier as UUPS proxy
 * @param viem Viem instance from Hardhat
 * @param ownerAddress Owner address for initialization
 * @returns Object with implementation, proxy, and verifier (proxy instance with implementation ABI)
 */
export async function deployCMVHVerifierProxy(viem: any, ownerAddress: string) {
  // Step 1: Deploy implementation
  const implementation = await viem.deployContract("CMVHVerifier", []);

  // Step 2: Encode initialize(owner) call
  const initializeData = encodeFunctionData({
    abi: implementation.abi,
    functionName: 'initialize',
    args: [ownerAddress]
  });

  // Step 3: Deploy ERC1967Proxy
  const proxy = await viem.deployContract("ERC1967ProxyWrapper", [
    implementation.address,
    initializeData
  ]);

  // Step 4: Get verifier instance (proxy with implementation ABI)
  const verifier = await viem.getContractAt("CMVHVerifier", proxy.address);

  return { implementation, proxy, verifier };
}

/**
 * Deploy CMVHRewardPool as UUPS proxy
 * @param viem Viem instance from Hardhat
 * @param wactTokenAddress wACT token address
 * @param verifierAddress CMVHVerifier address
 * @param feeCollectorAddress Fee collector address
 * @param ownerAddress Owner address for initialization
 * @returns Object with implementation, proxy, and rewardPool (proxy instance with implementation ABI)
 */
export async function deployCMVHRewardPoolProxy(
  viem: any,
  wactTokenAddress: string,
  verifierAddress: string,
  feeCollectorAddress: string,
  ownerAddress: string
) {
  // Step 1: Deploy implementation
  const implementation = await viem.deployContract("CMVHRewardPool", []);

  // Step 2: Encode initialize call
  // initialize(address _wactToken, address _verifier, address _feeCollector, address initialOwner)
  const initializeData = encodeFunctionData({
    abi: implementation.abi,
    functionName: 'initialize',
    args: [wactTokenAddress, verifierAddress, feeCollectorAddress, ownerAddress]
  });

  // Step 3: Deploy ERC1967Proxy
  const proxy = await viem.deployContract("ERC1967ProxyWrapper", [
    implementation.address,
    initializeData
  ]);

  // Step 4: Get rewardPool instance (proxy with implementation ABI)
  const rewardPool = await viem.getContractAt("CMVHRewardPool", proxy.address);

  return { implementation, proxy, rewardPool };
}
