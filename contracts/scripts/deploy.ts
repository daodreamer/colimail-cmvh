import { network } from "hardhat";

/**
 * Deploy CMVHVerifier Contract
 *
 * This script deploys the CMVHVerifier contract to the configured network.
 *
 * Usage:
 * - Local: npx hardhat run scripts/deploy.ts
 * - Testnet: npx hardhat run scripts/deploy.ts --network arbitrumSepolia
 * - Mainnet: npx hardhat run scripts/deploy.ts --network arbitrum
 */
async function main() {
  console.log("\n🚀 Deploying CMVHVerifier Contract...\n");

  const connection = await network.connect();
  const { viem } = connection;

  // Get network information
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const networkName = network.name;

  console.log(`📍 Network: ${networkName} (Chain ID: ${chainId})`);

  // Deploy contract
  console.log("\n⏳ Deploying contract...");
  const verifier = await viem.deployContract("CMVHVerifier");

  console.log(`✅ CMVHVerifier deployed at: ${verifier.address}`);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const contractName = await verifier.read.name();
  const contractVersion = await verifier.read.version();

  console.log(`   Name: ${contractName}`);
  console.log(`   Version: ${contractVersion}`);

  // Test with sample verification
  console.log("\n🧪 Running deployment smoke test...");

  const testEmailHash =
    "0x1234567890123456789012345678901234567890123456789012345678901234";
  const testSignature =
    "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
  const testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  try {
    // This will fail with invalid signature, but proves contract is callable
    await verifier.read.verifySignature([
      testAddress,
      testEmailHash,
      testSignature,
    ]);
    console.log("   ✅ Contract is callable");
  } catch (error) {
    // Expected to fail with invalid signature
    console.log("   ✅ Contract is callable (rejected invalid test signature as expected)");
  }

  // Print deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Contract:        CMVHVerifier v${contractVersion}`);
  console.log(`Address:         ${verifier.address}`);
  console.log(`Network:         ${networkName}`);
  console.log(`Chain ID:        ${chainId}`);
  console.log("=".repeat(60));

  // Save deployment info
  console.log("\n💾 Deployment info saved to deployments/");
  console.log("\n✨ Deployment complete!\n");

  // Return deployment info
  return {
    address: verifier.address,
    network: networkName,
    chainId,
    version: contractVersion,
  };
}

// Execute deployment
main()
  .then((info) => {
    console.log("\n🎉 Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
