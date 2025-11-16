import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { keccak256, encodeFunctionData, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * CMVH Verifier Contract Tests
 *
 * Following TDD methodology from CMVH_DEV.md:
 * 1. Write tests first
 * 2. Implement contract to pass tests
 * 3. Test interoperability with SDK
 *
 * Test Coverage:
 * - Signature verification (EOA)
 * - Email hash verification
 * - Invalid signature rejection
 * - Gas usage benchmarks
 */

describe("CMVHVerifier", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Test private key and account
  const TEST_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
  const signerAddress = testAccount.address;

  // Test email data matching SDK canonicalization
  const testEmail = {
    subject: "Test Email",
    from: "alice@example.com",
    to: "bob@example.com",
  };

  // Canonicalize email (matching SDK algorithm: subject\nfrom\nto - body excluded)
  function canonicalizeEmail(email: typeof testEmail): string {
    return `${email.subject}\n${email.from}\n${email.to}`;
  }

  // Hash email content
  function hashEmail(email: typeof testEmail): Hex {
    const canonical = canonicalizeEmail(email);
    return keccak256(new TextEncoder().encode(canonical));
  }

  let verifier: any;
  let emailHash: Hex;
  let signature: Hex;

  before(async function () {
    // Deploy CMVHVerifierV1 with proxy
    const [owner] = await viem.getWalletClients();
    const verifierImpl = await viem.deployContract("CMVHVerifierV1");

    const verifierInitCalldata = encodeFunctionData({
      abi: verifierImpl.abi,
      functionName: "initialize",
      args: [owner.account.address],
    });

    const verifierProxy = await viem.deployContract("TestProxy", [
      verifierImpl.address,
      verifierInitCalldata,
    ]);

    verifier = await viem.getContractAt("CMVHVerifierV1", verifierProxy.address);

    // Generate test signature
    emailHash = hashEmail(testEmail);
    signature = await testAccount.sign({ hash: emailHash });
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      assert.ok(verifier.address);
      assert.match(verifier.address, /^0x[0-9a-fA-F]{40}$/);
    });

    it("Should have correct contract name", async function () {
      const name = await verifier.read.name();
      assert.equal(name, "CMVHVerifier");
    });

    it("Should have correct version", async function () {
      const version = await verifier.read.version();
      assert.equal(version, "1.0.0");
    });
  });

  describe("Signature Verification", function () {
    it("Should verify valid EOA signature", async function () {
      const isValid = await verifier.read.verifySignature([
        signerAddress,
        emailHash,
        signature
      ]);

      assert.equal(isValid, true, "Valid signature should be verified");
    });

    it("Should reject invalid signature", async function () {
      // Tamper with signature
      const invalidSig = (signature.slice(0, -2) + "ff") as Hex;

      const isValid = await verifier.read.verifySignature([
        signerAddress,
        emailHash,
        invalidSig
      ]);

      assert.equal(isValid, false, "Invalid signature should be rejected");
    });

    it("Should reject signature with wrong address", async function () {
      const wrongAddress: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

      const isValid = await verifier.read.verifySignature([
        wrongAddress,
        emailHash,
        signature
      ]);

      assert.equal(isValid, false, "Signature with wrong address should be rejected");
    });

    it("Should reject signature for tampered content", async function () {
      // Create different email content (change subject)
      const tamperedEmail = { ...testEmail, subject: "Tampered Subject" };
      const tamperedHash = hashEmail(tamperedEmail);

      const isValid = await verifier.read.verifySignature([
        signerAddress,
        tamperedHash,
        signature
      ]);

      assert.equal(isValid, false, "Signature for different content should be rejected");
    });
  });

  describe("Email Hash Verification", function () {
    it("Should verify complete email data against signature", async function () {
      const result = await verifier.read.verifyEmail([
        signerAddress,
        testEmail.subject,
        testEmail.from,
        testEmail.to,
        signature
      ]);

      assert.equal(result, true, "Complete email verification should succeed");
    });

    it("Should reject verification with tampered subject", async function () {
      const result = await verifier.read.verifyEmail([
        signerAddress,
        "Tampered Subject",
        testEmail.from,
        testEmail.to,
        signature
      ]);

      assert.equal(result, false, "Tampered subject should fail verification");
    });

    it("Should reject verification with tampered from address", async function () {
      const result = await verifier.read.verifyEmail([
        signerAddress,
        testEmail.subject,
        "eve@malicious.com",
        testEmail.to,
        signature
      ]);

      assert.equal(result, false, "Tampered from address should fail verification");
    });

    it("Should handle empty subject", async function () {
      const emptySubjectEmail = { ...testEmail, subject: "" };
      const hash = hashEmail(emptySubjectEmail);
      const sig = await testAccount.sign({ hash });

      const result = await verifier.read.verifyEmail([
        signerAddress,
        "",
        testEmail.from,
        testEmail.to,
        sig
      ]);

      assert.equal(result, true, "Empty subject should be valid");
    });

    it("Should handle Unicode content", async function () {
      const unicodeEmail = {
        subject: "测试邮件 🎉",
        from: "用户@example.com",
        to: "接收者@example.com",
      };

      const hash = hashEmail(unicodeEmail);
      const sig = await testAccount.sign({ hash });

      const result = await verifier.read.verifyEmail([
        signerAddress,
        unicodeEmail.subject,
        unicodeEmail.from,
        unicodeEmail.to,
        sig
      ]);

      assert.equal(result, true, "Unicode content should be verified");
    });
  });

  describe("Gas Usage Benchmarks", function () {
    it("Should estimate gas for verifySignature", async function () {
      // Estimate gas for view function call
      const gasEstimate = await publicClient.estimateContractGas({
        address: verifier.address,
        abi: verifier.abi,
        functionName: "verifySignature",
        args: [signerAddress, emailHash, signature]
      });

      // Should be well under 100k gas as per Phase 2 requirements
      assert.ok(gasEstimate < 100000n, `Gas estimate (${gasEstimate}) should be < 100k`);

      console.log(`\n  ⛽ Gas estimate for verifySignature: ${gasEstimate}`);
    });

    it("Should estimate gas for verifyEmail", async function () {
      // Estimate gas for view function call
      const gasEstimate = await publicClient.estimateContractGas({
        address: verifier.address,
        abi: verifier.abi,
        functionName: "verifyEmail",
        args: [
          signerAddress,
          testEmail.subject,
          testEmail.from,
          testEmail.to,
          signature
        ]
      });

      assert.ok(gasEstimate < 100000n, `Gas estimate (${gasEstimate}) should be < 100k`);

      console.log(`  ⛽ Gas estimate for verifyEmail: ${gasEstimate}`);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very long subject", async function () {
      const longSubject = "A".repeat(1000);
      const longEmail = { ...testEmail, subject: longSubject };
      const hash = hashEmail(longEmail);
      const sig = await testAccount.sign({ hash });

      const result = await verifier.read.verifyEmail([
        signerAddress,
        longEmail.subject,
        longEmail.from,
        longEmail.to,
        sig
      ]);

      assert.equal(result, true, "Long subject should be verified");
    });

    it("Should handle special characters in email fields", async function () {
      const specialEmail = {
        subject: "Re: [URGENT] <Test> & 'Quote'",
        from: "user+tag@sub.example.com",
        to: "recipient@example.co.uk",
      };

      const hash = hashEmail(specialEmail);
      const sig = await testAccount.sign({ hash });

      const result = await verifier.read.verifyEmail([
        signerAddress,
        specialEmail.subject,
        specialEmail.from,
        specialEmail.to,
        sig
      ]);

      assert.equal(result, true, "Special characters should be handled correctly");
    });
  });

  describe("View Functions", function () {
    it("Should recover signer address from valid signature", async function () {
      const recovered = await verifier.read.recoverSigner([
        emailHash,
        signature
      ]);

      assert.equal(
        recovered.toLowerCase(),
        signerAddress.toLowerCase(),
        "Should recover correct signer address"
      );
    });

    it("Should compute correct email hash", async function () {
      const computed = await verifier.read.hashEmail([
        testEmail.subject,
        testEmail.from,
        testEmail.to
      ]);

      assert.equal(computed, emailHash, "Contract should compute same hash as SDK");
    });
  });
});
