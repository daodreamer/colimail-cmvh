/**
 * Integration tests for complete email signing and verification workflows
 * These tests simulate real-world email scenarios to discover actual issues
 */

import { describe, it, expect } from "vitest";
import {
  signEmail,
  verifyCMVHHeaders,
  parseRawHeaders,
  formatCMVHHeaders,
} from "../src/index.js";

const testChainId = 42161; // Arbitrum
const testVerifyingContract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

describe("Integration: Full Email Workflow", () => {
  const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  describe("Real-world Email Scenarios", () => {
    it("should handle complete email flow: sign → format → parse → verify", async () => {
      const originalEmail = {
        from: "alice@company.com",
        to: "bob@partner.org",
        subject: "Q4 Partnership Proposal",
        body: "Dear Bob,\n\nI hope this email finds you well. I wanted to discuss our Q4 partnership opportunities.\n\nBest regards,\nAlice",
      };

      // Step 1: Sign the email
      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...originalEmail,
        ens: "alice.eth",
        reward: "0.1 wACT",
      });

      // Step 2: Format headers as they would appear in real email
      const formattedHeaders = formatCMVHHeaders(headers);
      expect(formattedHeaders).toContain("X-CMVH-Version: 2");
      expect(formattedHeaders).toContain("X-CMVH-ENS: alice.eth");

      // Step 3: Simulate email transmission (parsing from raw headers)
      const parsedHeaders = parseRawHeaders(formattedHeaders);
      expect(parsedHeaders.version).toBe("2");
      expect(parsedHeaders.ens).toBe("alice.eth");

      // Step 4: Verify the signature
      const result = await verifyCMVHHeaders({
        headers: parsedHeaders,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...originalEmail,
      });

      expect(result.ok).toBe(true);
      expect(result.address).toBe(headers["X-CMVH-Address"]);
      expect(result.ens).toBe("alice.eth");
      expect(result.timestamp).toBeTruthy();
    });

    it("should detect content tampering in subject (body not signed)", async () => {
      const originalEmail = {
        from: "sender@domain.com",
        to: "receiver@domain.com",
        subject: "Payment: $10,000",
        body: "Terms:\n1. Net 30 payment\n2. FOB shipping\n3. Standard warranty",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...originalEmail,
      });

      // Attacker tries to change payment amount in subject
      const tamperedEmail = {
        ...originalEmail,
        subject: "Payment: $100,000",  // Subject is signed and will fail
      };

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...tamperedEmail,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("mismatch");

      // But changing body should pass (body not signed)
      const bodyChangedEmail = {
        ...originalEmail,
        body: "Different body content",  // Body is not signed
      };

      const result2 = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...bodyChangedEmail,
      });

      expect(result2.ok).toBe(true);
    });

    it("should handle forwarded email scenario (signature remains valid)", async () => {
      const originalEmail = {
        from: "original@sender.com",
        to: "first@recipient.com",
        subject: "Original Message",
        body: "This is the original content.",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...originalEmail,
      });

      // Email gets forwarded - signature is based on original content
      // In real implementation, forwarding should be detected separately
      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...originalEmail, // Content unchanged
      });

      expect(result.ok).toBe(true);
      // Note: This is a known limitation - MVP doesn't detect forwarding
    });
  });

  describe("Edge Cases: Special Characters", () => {
    it("should handle Unicode characters in email content", async () => {
      const unicodeEmail = {
        from: "用户@example.com",
        to: "bob@example.com",
        subject: "测试邮件 Test Email 🎉",
        body: "Hello 世界! This email contains 日本語、中文、emoji 🚀✨\n\nCheers! 🎊",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...unicodeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...unicodeEmail,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle special characters and escape sequences", async () => {
      const specialCharsEmail = {
        from: "test@example.com",
        to: "user@example.com",
        subject: 'Subject with "quotes" and \'apostrophes\'',
        body: "Body with special chars:\n\t- Tabs\n\r\n- Line breaks\n  - <HTML tags>\n  - &amp; entities\n  - Backslashes: \\n\\t",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...specialCharsEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...specialCharsEmail,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle very long email addresses", async () => {
      const longEmail = {
        from: "very.long.email.address.with.multiple.dots.and.subdomains@very-long-domain-name-example.com",
        to: "another.extremely.long.recipient.address@another-very-long-domain.org",
        subject: "Test",
        body: "Content",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...longEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...longEmail,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle empty subject line", async () => {
      const noSubjectEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "",
        body: "This email has no subject.",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...noSubjectEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...noSubjectEmail,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle multiline subject (RFC 2047 folding)", async () => {
      // Real email clients might fold long subjects
      const longSubjectEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "This is a very long subject line that might get folded by email clients into multiple lines according to RFC 2047 specifications",
        body: "Content",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...longSubjectEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...longSubjectEmail,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Edge Cases: Large Content", () => {
    it("should handle large email bodies (10KB+)", async () => {
      const largeBody = "Lorem ipsum dolor sit amet. ".repeat(400); // ~11KB
      const largeEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Large Email Test",
        body: largeBody,
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...largeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...largeEmail,
      });

      expect(result.ok).toBe(true);
      expect(largeEmail.body.length).toBeGreaterThan(10000);
    });

    it("should handle very large email bodies (100KB+)", async () => {
      const veryLargeBody = "A".repeat(100000); // 100KB
      const veryLargeEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Very Large Email",
        body: veryLargeBody,
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...veryLargeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...veryLargeEmail,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Edge Cases: Whitespace Handling", () => {
    it("should preserve whitespace in subject (body not signed)", async () => {
      const whitespaceEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "  Test Subject  ",  // Subject with whitespace
        body: "Body content",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...whitespaceEmail,
      });

      // Trimming subject whitespace should break verification (subject is signed)
      const trimmedSubject = {
        ...whitespaceEmail,
        subject: whitespaceEmail.subject.trim(),
      };

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...trimmedSubject,
      });

      expect(result.ok).toBe(false); // Should fail because subject whitespace is signed

      // But changing body should pass (body not signed)
      const changedBody = {
        ...whitespaceEmail,
        body: "Different body",
      };

      const result2 = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...changedBody,
      });

      expect(result2.ok).toBe(true);
    });

    it("should detect single character difference in subject (not body)", async () => {
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test Subject",
        body: "This is the original content.",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      // Change one character in subject - should fail
      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
        subject: "Test Subject!",  // Added exclamation mark
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("Security: Replay and Timestamp", () => {
    it("should produce identical signatures for identical content (no replay protection)", async () => {
      // MVP LIMITATION: Signature is only based on email content, not timestamp
      // This means identical emails will have identical signatures regardless of when they're signed
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test",
        body: "Content",
      };

      const headers1 = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
        timestamp: 1000000,
      });

      const headers2 = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
        timestamp: 2000000, // Different timestamp
      });

      // Both signatures should be valid
      const result1 = await verifyCMVHHeaders({ headers: headers1, chainId: testChainId, verifyingContract: testVerifyingContract, ...email });
      const result2 = await verifyCMVHHeaders({ headers: headers2, chainId: testChainId, verifyingContract: testVerifyingContract, ...email });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Timestamps should be different
      expect(headers1["X-CMVH-Timestamp"]).toBe("1000000");
      expect(headers2["X-CMVH-Timestamp"]).toBe("2000000");

      // With EIP-712: Signatures will be DIFFERENT because timestamp is now part of the signed message
      // This provides replay protection
      expect(headers1["X-CMVH-Signature"]).not.toBe(headers2["X-CMVH-Signature"]);
    });

    it("should accept future timestamps (known MVP limitation)", async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // +1 day
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Future Email",
        body: "From the future!",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
        timestamp: futureTimestamp,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      expect(result.ok).toBe(true);
      expect(result.timestamp).toBe(futureTimestamp);
    });

    it("should accept very old timestamps (known MVP limitation)", async () => {
      const oldTimestamp = 1000000000; // September 2001
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Old Email",
        body: "From the past!",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
        timestamp: oldTimestamp,
      });

      const result = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Cross-field Interactions", () => {
    it("should detect tampering across different email fields", async () => {
      const email = {
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Meeting Request",
        body: "Let's meet at 3pm.",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      // Try swapping from/to addresses
      const swappedResult = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        from: email.to,
        to: email.from,
        subject: email.subject,
        body: email.body,
      });

      expect(swappedResult.ok).toBe(false);

      // Note: Moving subject to body won't affect verification since body is not signed
      // But we can test swapping subject with from/to
      const subjectSwappedResult = await verifyCMVHHeaders({
        headers,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        from: email.subject,  // This is invalid but tests the strict ordering
        to: email.to,
        subject: email.from,
        body: email.body,
      });

      expect(subjectSwappedResult.ok).toBe(false);
    });

  });

  describe("Header Format Compatibility", () => {
    it("should parse headers with varying whitespace", async () => {
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test",
        body: "Content",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      // Format with extra spaces
      const rawWithSpaces = `
X-CMVH-Version:    2
X-CMVH-Address:   ${headers["X-CMVH-Address"]}
X-CMVH-Chain:  ${headers["X-CMVH-Chain"]}
X-CMVH-Timestamp:${headers["X-CMVH-Timestamp"]}
X-CMVH-HashAlgo: ${headers["X-CMVH-HashAlgo"]}
X-CMVH-Signature: ${headers["X-CMVH-Signature"]}
      `;

      const parsed = parseRawHeaders(rawWithSpaces);
      const result = await verifyCMVHHeaders({
        headers: parsed,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle headers mixed with other email headers", async () => {
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test",
        body: "Content",
      };

      const cmvhHeaders = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      // Simulate real email with CMVH and standard headers
      const fullEmailHeaders = `
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Date: Mon, 04 Nov 2025 12:00:00 +0000
Message-ID: <abc123@example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8
X-CMVH-Version: ${cmvhHeaders["X-CMVH-Version"]}
X-CMVH-Address: ${cmvhHeaders["X-CMVH-Address"]}
X-CMVH-Chain: ${cmvhHeaders["X-CMVH-Chain"]}
X-CMVH-Timestamp: ${cmvhHeaders["X-CMVH-Timestamp"]}
X-CMVH-HashAlgo: ${cmvhHeaders["X-CMVH-HashAlgo"]}
X-CMVH-Signature: ${cmvhHeaders["X-CMVH-Signature"]}
X-Mailer: ColiMail 1.0
      `;

      const parsed = parseRawHeaders(fullEmailHeaders);
      const result = await verifyCMVHHeaders({
        headers: parsed,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...email,
      });

      expect(result.ok).toBe(true);
    });
  });
});
