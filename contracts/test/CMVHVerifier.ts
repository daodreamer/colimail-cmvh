import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { keccak256, encodeAbiParameters, encodePacked, encodeFunctionData, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * CMVH Verifier Contract Tests (UUPS Upgradeable with Timestamp)
 *
 * Following TDD methodology from CMVH_DEV.md:
 * 1. Write tests first
 * 2. Implement contract to pass tests
 * 3. Test interoperability with SDK
 *
 * Test Coverage:
 * - UUPS proxy deployment and initialization
 * - Signature verification with timestamp (replay protection)
 * - Email hash verification
 * - Invalid signature rejection
 * - Upgrade authorization
 * - Gas usage benchmarks
 */

describe("CMVHVerifier (UUPS Upgradeable)", async function () {
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

  const testTimestamp = Math.floor(Date.now() / 1000);

  // EIP-712 constants matching contract
  const EMAIL_TYPEHASH = keccak256("Email(string subject,string from,string to,uint256 timestamp)");

  // Helper to get EIP-712 struct hash with timestamp
  function getEmailStructHash(email: typeof testEmail, timestamp: number): Hex {
    return keccak256(encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' }
      ],
      [
        EMAIL_TYPEHASH,
        keccak256(email.subject),
        keccak256(email.from),
        keccak256(email.to),
        BigInt(timestamp)
      ]
    ));
  }

  // Helper to create EIP-712 signature with timestamp
  async function signEmailEIP712(
    email: typeof testEmail,
    timestamp: number,
    domainSeparator: Hex
  ): Promise<Hex> {
    const structHash = getEmailStructHash(email, timestamp);
    const digest = keccak256(encodePacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      ['0x19', '0x01', domainSeparator, structHash]
    ));
    return await testAccount.sign({ hash: digest });
  }

  let implementation: any;
  let proxy: any;
  let verifier: any;
  let emailStructHash: Hex;
  let signature: Hex;
  let domainSeparator: Hex;
  let owner: any;

  before(async function () {
    // Get deployer/owner account
    const walletClients = await viem.getWalletClients();
    owner = walletClients[0];

    // Step 1: Deploy implementation
    implementation = await viem.deployContract("CMVHVerifier", []);

    // Step 2: Encode initialize(owner) call
    const initializeData = encodeFunctionData({
      abi: implementation.abi,
      functionName: 'initialize',
      args: [owner.account.address]
    });

    // Step 3: Deploy ERC1967Proxy
    proxy = await viem.deployContract("ERC1967ProxyWrapper", [
      implementation.address,
      initializeData
    ]);

    // Step 4: Get verifier instance (proxy with implementation ABI)
    verifier = await viem.getContractAt("CMVHVerifier", proxy.address);

    // Get domain separator from proxied contract
    domainSeparator = await verifier.read.getDomainSeparator();

    // Generate test signature with EIP-712 and timestamp
    emailStructHash = getEmailStructHash(testEmail, testTimestamp);
    signature = await signEmailEIP712(testEmail, testTimestamp, domainSeparator);
  });

  describe("UUPS Proxy Deployment", function () {
    it("Should deploy implementation successfully", async function () {
      assert.ok(implementation.address);
      assert.match(implementation.address, /^0x[0-9a-fA-F]{40}$/);
    });

    it("Should deploy proxy successfully", async function () {
      assert.ok(proxy.address);
      assert.match(proxy.address, /^0x[0-9a-fA-F]{40}$/);
    });

    it("Should initialize proxy with correct owner", async function () {
      const contractOwner = await verifier.read.owner();
      assert.equal(
        contractOwner.toLowerCase(),
        owner.account.address.toLowerCase(),
        "Proxy should be initialized with correct owner"
      );
    });

    it("Should have correct contract name through proxy", async function () {
      const name = await verifier.read.NAME();
      assert.equal(name, "CMVHVerifier");
    });

    it("Should have correct version through proxy", async function () {
      const version = await verifier.read.VERSION();
      assert.equal(version, "2.0.0");
    });
  });

  describe("Signature Verification with Timestamp", function () {
    it("Should verify valid EOA signature with timestamp", async function () {
      const isValid = await verifier.read.verifySignature([
        signerAddress,
        emailStructHash,
        signature
      ]);

      assert.equal(isValid, true, "Valid signature with timestamp should be verified");
    });

    it("Should verify complete email with timestamp", async function () {
      const result = await verifier.read.verifyEmail([
        signerAddress,
        testEmail.subject,
        testEmail.from,
        testEmail.to,
        testTimestamp,
        signature
      ]);

      assert.equal(result, true, "Complete email with timestamp should be verified");
    });

    it("Should reject signature with different timestamp (replay protection)", async function () {
      const differentTimestamp = testTimestamp + 3600; // +1 hour

      const result = await verifier.read.verifyEmail([
        signerAddress,
        testEmail.subject,
        testEmail.from,
        testEmail.to,
        differentTimestamp, // Different timestamp
        signature // Same signature (should fail)
      ]);

      assert.equal(result, false, "Signature with different timestamp should be rejected");
    });

    it("Should reject invalid signature", async function () {
      // Tamper with signature
      const invalidSig = (signature.slice(0, -2) + "ff") as Hex;

      const isValid = await verifier.read.verifySignature([
        signerAddress,
        emailStructHash,
        invalidSig
      ]);

      assert.equal(isValid, false, "Invalid signature should be rejected");
    });

    it("Should reject signature with wrong address", async function () {
      const wrongAddress: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

      const isValid = await verifier.read.verifySignature([
        wrongAddress,
        emailStructHash,
        signature
      ]);

      assert.equal(isValid, false, "Signature with wrong address should be rejected");
    });
  });

  describe("Email Content Verification", function () {
    it("Should reject verification with tampered subject", async function () {
      const result = await verifier.read.verifyEmail([
        signerAddress,
        "Tampered Subject",
        testEmail.from,
        testEmail.to,
        testTimestamp,
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
        testTimestamp,
        signature
      ]);

      assert.equal(result, false, "Tampered from address should fail verification");
    });

    it("Should handle empty subject with timestamp", async function () {
      const emptySubjectEmail = { ...testEmail, subject: "" };
      const ts = testTimestamp + 1;
      const sig = await signEmailEIP712(emptySubjectEmail, ts, domainSeparator);

      const result = await verifier.read.verifyEmail([
        signerAddress,
        "",
        testEmail.from,
        testEmail.to,
        ts,
        sig
      ]);

      assert.equal(result, true, "Empty subject with timestamp should be valid");
    });

    it("Should handle Unicode content with timestamp", async function () {
      const unicodeEmail = {
        subject: "测试邮件 🎉",
        from: "用户@example.com",
        to: "接收者@example.com",
      };

      const ts = testTimestamp + 2;
      const sig = await signEmailEIP712(unicodeEmail, ts, domainSeparator);

      const result = await verifier.read.verifyEmail([
        signerAddress,
        unicodeEmail.subject,
        unicodeEmail.from,
        unicodeEmail.to,
        ts,
        sig
      ]);

      assert.equal(result, true, "Unicode content with timestamp should be verified");
    });
  });

  describe("UUPS Upgrade Authorization", function () {
    it("Should allow owner to call upgradeToAndCall", async function () {
      // Deploy a new implementation (same contract for testing)
      const newImpl = await viem.deployContract("CMVHVerifier", []);

      // Owner should be able to upgrade
      const hash = await verifier.write.upgradeToAndCall(
        [newImpl.address, "0x"],
        { account: owner.account }
      );

      assert.ok(hash, "Upgrade transaction should succeed");
    });

    it("Should prevent non-owner from upgrading", async function () {
      const [, , nonOwner] = await viem.getWalletClients();
      const newImpl = await viem.deployContract("CMVHVerifier", []);

      try {
        await verifier.write.upgradeToAndCall(
          [newImpl.address, "0x"],
          { account: nonOwner.account }
        );
        assert.fail("Non-owner upgrade should have been rejected");
      } catch (error: any) {
        assert.ok(
          error.message.includes("OwnableUnauthorizedAccount") ||
          error.message.includes("Ownable"),
          "Should revert with Ownable error"
        );
      }
    });
  });

  describe("Gas Usage Benchmarks", function () {
    it("Should estimate gas for verifySignature", async function () {
      // Estimate gas for state-changing function call
      const gasEstimate = await publicClient.estimateContractGas({
        address: verifier.address,
        abi: verifier.abi,
        functionName: "verifySignature",
        args: [signerAddress, emailStructHash, signature],
        account: owner.account
      });

      // Should be well under 100k gas as per Phase 2 requirements
      assert.ok(gasEstimate < 100000n, `Gas estimate (${gasEstimate}) should be < 100k`);

      console.log(`\n  ⛽ Gas estimate for verifySignature: ${gasEstimate}`);
    });

    it("Should estimate gas for verifyEmail", async function () {
      const gasEstimate = await publicClient.estimateContractGas({
        address: verifier.address,
        abi: verifier.abi,
        functionName: "verifyEmail",
        args: [
          signerAddress,
          testEmail.subject,
          testEmail.from,
          testEmail.to,
          testTimestamp,
          signature
        ],
        account: owner.account
      });

      assert.ok(gasEstimate < 100000n, `Gas estimate (${gasEstimate}) should be < 100k`);

      console.log(`  ⛽ Gas estimate for verifyEmail: ${gasEstimate}`);
    });
  });

  describe("View Functions", function () {
    it("Should compute correct email struct hash", async function () {
      const computed = await verifier.read.getEmailStructHash([
        testEmail.subject,
        testEmail.from,
        testEmail.to,
        testTimestamp
      ]);

      assert.equal(computed, emailStructHash, "Contract should compute same hash as test");
    });

    it("Should get implementation version", async function () {
      const version = await verifier.read.getImplementationVersion();
      assert.equal(version, "2.0.0", "Should return correct implementation version");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very long subject with timestamp", async function () {
      const longSubject = "A".repeat(1000);
      const longEmail = { ...testEmail, subject: longSubject };
      const ts = testTimestamp + 3;
      const sig = await signEmailEIP712(longEmail, ts, domainSeparator);

      const result = await verifier.read.verifyEmail([
        signerAddress,
        longEmail.subject,
        longEmail.from,
        longEmail.to,
        ts,
        sig
      ]);

      assert.equal(result, true, "Long subject with timestamp should be verified");
    });

    it("Should handle special characters with timestamp", async function () {
      const specialEmail = {
        subject: "Re: [URGENT] <Test> & 'Quote'",
        from: "user+tag@sub.example.com",
        to: "recipient@example.co.uk",
      };

      const ts = testTimestamp + 4;
      const sig = await signEmailEIP712(specialEmail, ts, domainSeparator);

      const result = await verifier.read.verifyEmail([
        signerAddress,
        specialEmail.subject,
        specialEmail.from,
        specialEmail.to,
        ts,
        sig
      ]);

      assert.equal(result, true, "Special characters with timestamp should be handled");
    });
  });
});
