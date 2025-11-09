/**
 * Example: Sign and verify an email using CMVH
 */

import { signEmail, verifyCMVHHeaders } from "../dist/index.js";

async function main() {
  console.log("🔐 CMVH Email Signing Example\n");

  // Test private key (DO NOT use in production!)
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  const emailContent = {
    from: "alice@example.com",
    to: "bob@example.com",
    subject: "Partnership Proposal",
    body: "Hello Bob,\n\nI'd like to discuss a potential partnership opportunity.\n\nBest regards,\nAlice",
  };

  // Step 1: Sign the email
  console.log("📝 Signing email...");
  const headers = await signEmail({
    privateKey,
    ...emailContent,
    ens: "alice.eth",
    reward: "0.05 wACT",
  });

  console.log("\n✅ Generated CMVH Headers:");
  console.log(JSON.stringify(headers, null, 2));

  // Step 2: Verify the signature
  console.log("\n🔍 Verifying signature...");
  const result = await verifyCMVHHeaders({
    headers,
    ...emailContent,
  });

  if (result.ok) {
    console.log("\n✅ Verification SUCCESSFUL!");
    console.log(`   Address: ${result.address}`);
    console.log(`   ENS: ${result.ens}`);
    console.log(`   Timestamp: ${new Date((result.timestamp || 0) * 1000).toISOString()}`);
  } else {
    console.log("\n❌ Verification FAILED!");
    console.log(`   Reason: ${result.reason}`);
  }

  // Step 3: Test tampering detection
  console.log("\n🧪 Testing tampering detection...");
  const tamperedResult = await verifyCMVHHeaders({
    headers,
    ...emailContent,
    body: "Tampered message!",
  });

  console.log(`   Result: ${tamperedResult.ok ? "✅ Passed" : "❌ Failed (as expected)"}`);
  console.log(`   Reason: ${tamperedResult.reason}`);
}

main().catch(console.error);
