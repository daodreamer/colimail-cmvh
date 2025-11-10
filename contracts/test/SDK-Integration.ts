import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * SDK-Contract Integration Tests
 *
 * Testing interoperability between:
 * - SDK (sdk/cmvh-js) signature generation
 * - Contract (contracts/CMVHVerifier.sol) signature verification
 *
 * This ensures that emails signed with the SDK can be verified on-chain
 */

describe("SDK-Contract Integration", async function () {
  const { viem } = await network.connect();

  // Import SDK functions (dynamic import for ESM compatibility)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const sdkPath = join(__dirname, "../../sdk/cmvh-js/dist/index.js");

  let signEmail: any;
  let verifyEmail: any;
  let parseRawHeaders: any;
  let sdk: any;

  // Test account
  const TEST_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

  let verifier: any;

  before(async function () {
    // Deploy contract
    verifier = await viem.deployContract("CMVHVerifier");

    // Try to import SDK (skip if not built)
    try {
      sdk = await import(sdkPath);
      signEmail = sdk.signEmail;
      verifyEmail = sdk.verifyEmail;
      parseRawHeaders = sdk.parseRawHeaders;
    } catch (error) {
      console.warn("\n  ⚠️  SDK not built, skipping integration tests");
      console.warn("  Run 'npm run build' in sdk/cmvh-js/ to enable these tests\n");
    }
  });

  describe("Email Signing and Verification Flow", function () {
    it("Should verify SDK-signed email on-chain", async function () {
      if (!signEmail) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Integration Test",
        body: "This email was signed by SDK and verified by contract"
      };

      // 1. Sign email with SDK
      const headers = await signEmail({
        ...emailContent,
        privateKey: TEST_PRIVATE_KEY,
        chain: "Arbitrum"
      });

      // 2. Extract signature from headers
      const cmvhHeaders = parseRawHeaders(headers);
      const signature = cmvhHeaders["X-CMVH-Signature"];
      const signerAddress = cmvhHeaders["X-CMVH-Address"];

      // 3. Verify on-chain with contract
      const isValid = await verifier.read.verifyEmail([
        signerAddress,
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body,
        signature
      ]);

      assert.equal(isValid, true, "SDK-signed email should be verified by contract");
    });

    it("Should reject SDK-signed email with tampered content", async function () {
      if (!signEmail) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Original Subject",
        body: "Original body"
      };

      // Sign with SDK
      const headers = await signEmail({
        ...emailContent,
        privateKey: TEST_PRIVATE_KEY,
        chain: "Arbitrum"
      });

      const cmvhHeaders = parseRawHeaders(headers);
      const signature = cmvhHeaders["X-CMVH-Signature"];
      const signerAddress = cmvhHeaders["X-CMVH-Address"];

      // Attempt to verify with tampered content
      const isValid = await verifier.read.verifyEmail([
        signerAddress,
        "Tampered Subject", // Changed
        emailContent.from,
        emailContent.to,
        emailContent.body,
        signature
      ]);

      assert.equal(isValid, false, "Tampered email should fail verification");
    });

    it("Should verify emails with Unicode content", async function () {
      if (!signEmail) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "用户@example.com",
        to: "接收者@example.com",
        subject: "测试主题 🎉",
        body: "邮件内容包含中文和emoji 🌍✨"
      };

      // Sign with SDK
      const headers = await signEmail({
        ...emailContent,
        privateKey: TEST_PRIVATE_KEY,
        chain: "Arbitrum"
      });

      const cmvhHeaders = parseRawHeaders(headers);
      const signature = cmvhHeaders["X-CMVH-Signature"];
      const signerAddress = cmvhHeaders["X-CMVH-Address"];

      // Verify on-chain
      const isValid = await verifier.read.verifyEmail([
        signerAddress,
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body,
        signature
      ]);

      assert.equal(isValid, true, "Unicode email should be verified");
    });

    it("Should verify large emails (10KB body)", async function () {
      if (!signEmail) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const largeBody = "This is a long email body. ".repeat(400); // ~10KB

      const emailContent = {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Large Email Test",
        body: largeBody
      };

      // Sign with SDK
      const headers = await signEmail({
        ...emailContent,
        privateKey: TEST_PRIVATE_KEY,
        chain: "Arbitrum"
      });

      const cmvhHeaders = parseRawHeaders(headers);
      const signature = cmvhHeaders["X-CMVH-Signature"];
      const signerAddress = cmvhHeaders["X-CMVH-Address"];

      // Verify on-chain
      const isValid = await verifier.read.verifyEmail([
        signerAddress,
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body,
        signature
      ]);

      assert.equal(isValid, true, "Large email should be verified");
    });
  });

  describe("Hash Compatibility", function () {
    it("Should compute same hash as SDK", async function () {
      if (!sdk) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "test@example.com",
        to: "verify@example.com",
        subject: "Hash Test",
        body: "Testing hash compatibility"
      };

      // Compute hash with SDK
      const { canonicalizeEmail, keccak256: sdkKeccak } = sdk;
      const canonical = canonicalizeEmail(emailContent);
      const sdkHash = sdkKeccak(canonical);

      // Compute hash with contract
      const contractHash = await verifier.read.hashEmail([
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body
      ]);

      assert.equal(contractHash, sdkHash, "Contract and SDK should compute same hash");
    });

    it("Should handle empty fields consistently", async function () {
      if (!sdk) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "empty@example.com",
        to: "test@example.com",
        subject: "",
        body: ""
      };

      const { canonicalizeEmail, keccak256: sdkKeccak } = sdk;
      const canonical = canonicalizeEmail(emailContent);
      const sdkHash = sdkKeccak(canonical);

      const contractHash = await verifier.read.hashEmail([
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body
      ]);

      assert.equal(contractHash, sdkHash, "Empty fields should hash consistently");
    });
  });

  describe("Performance Comparison", function () {
    it("Should report SDK vs Contract verification performance", async function () {
      if (!signEmail || !verifyEmail) {
        console.log("  ⏭️  Skipping (SDK not available)");
        return;
      }

      const emailContent = {
        from: "perf@example.com",
        to: "test@example.com",
        subject: "Performance Test",
        body: "Comparing SDK and contract verification speed"
      };

      // Sign with SDK
      const headers = await signEmail({
        ...emailContent,
        privateKey: TEST_PRIVATE_KEY,
        chain: "Arbitrum"
      });

      const cmvhHeaders = parseRawHeaders(headers);

      // Measure SDK verification time
      const sdkStart = performance.now();
      const sdkResult = await verifyEmail(emailContent, headers);
      const sdkTime = performance.now() - sdkStart;

      // Measure contract verification time
      const contractStart = performance.now();
      const contractResult = await verifier.read.verifyEmail([
        cmvhHeaders["X-CMVH-Address"],
        emailContent.subject,
        emailContent.from,
        emailContent.to,
        emailContent.body,
        cmvhHeaders["X-CMVH-Signature"]
      ]);
      const contractTime = performance.now() - contractStart;

      console.log(`\n  📊 Verification Performance:`);
      console.log(`     SDK:      ${sdkTime.toFixed(2)}ms`);
      console.log(`     Contract: ${contractTime.toFixed(2)}ms\n`);

      assert.equal(sdkResult, true, "SDK verification should succeed");
      assert.equal(contractResult, true, "Contract verification should succeed");
    });
  });
});
