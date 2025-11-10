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
  canonicalizeEmail,
} from "../src/index.js";

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
        ...originalEmail,
        ens: "alice.eth",
        reward: "0.1 wACT",
      });

      // Step 2: Format headers as they would appear in real email
      const formattedHeaders = formatCMVHHeaders(headers);
      expect(formattedHeaders).toContain("X-CMVH-Version: 1");
      expect(formattedHeaders).toContain("X-CMVH-ENS: alice.eth");

      // Step 3: Simulate email transmission (parsing from raw headers)
      const parsedHeaders = parseRawHeaders(formattedHeaders);
      expect(parsedHeaders.version).toBe("1");
      expect(parsedHeaders.ens).toBe("alice.eth");

      // Step 4: Verify the signature
      const result = await verifyCMVHHeaders({
        headers: parsedHeaders,
        ...originalEmail,
      });

      expect(result.ok).toBe(true);
      expect(result.address).toBe(headers["X-CMVH-Address"]);
      expect(result.ens).toBe("alice.eth");
      expect(result.timestamp).toBeTruthy();
    });

    it("should detect content tampering in multiline email body", async () => {
      const originalEmail = {
        from: "sender@domain.com",
        to: "receiver@domain.com",
        subject: "Important Contract",
        body: "Payment amount: $10,000\n\nTerms:\n1. Net 30 payment\n2. FOB shipping\n3. Standard warranty",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        ...originalEmail,
      });

      // Attacker tries to change payment amount
      const tamperedEmail = {
        ...originalEmail,
        body: "Payment amount: $100,000\n\nTerms:\n1. Net 30 payment\n2. FOB shipping\n3. Standard warranty",
      };

      const result = await verifyCMVHHeaders({
        headers,
        ...tamperedEmail,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toContain("mismatch");
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
        ...originalEmail,
      });

      // Email gets forwarded - signature is based on original content
      // In real implementation, forwarding should be detected separately
      const result = await verifyCMVHHeaders({
        headers,
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
        ...unicodeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...specialCharsEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...longEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...noSubjectEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...longSubjectEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...largeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...veryLargeEmail,
      });

      const result = await verifyCMVHHeaders({
        headers,
        ...veryLargeEmail,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Edge Cases: Whitespace Handling", () => {
    it("should preserve leading and trailing whitespace in body", async () => {
      const whitespaceEmail = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test",
        body: "  \n\n  Leading and trailing spaces  \n\n  ",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        ...whitespaceEmail,
      });

      // Removing even one space should break verification
      const trimmedEmail = {
        ...whitespaceEmail,
        body: whitespaceEmail.body.trim(),
      };

      const result = await verifyCMVHHeaders({
        headers,
        ...trimmedEmail,
      });

      expect(result.ok).toBe(false); // Should fail because whitespace is significant
    });

    it("should detect single character difference in body", async () => {
      const email = {
        from: "sender@example.com",
        to: "receiver@example.com",
        subject: "Test",
        body: "This is the original content.",
      };

      const headers = await signEmail({
        privateKey: testPrivateKey,
        ...email,
      });

      // Change one character
      const result = await verifyCMVHHeaders({
        headers,
        ...email,
        body: "This is the original content!",
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
        ...email,
        timestamp: 1000000,
      });

      const headers2 = await signEmail({
        privateKey: testPrivateKey,
        ...email,
        timestamp: 2000000, // Different timestamp
      });

      // Both signatures should be valid
      const result1 = await verifyCMVHHeaders({ headers: headers1, ...email });
      const result2 = await verifyCMVHHeaders({ headers: headers2, ...email });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Timestamps should be different
      expect(headers1["X-CMVH-Timestamp"]).toBe("1000000");
      expect(headers2["X-CMVH-Timestamp"]).toBe("2000000");

      // CRITICAL MVP LIMITATION: Signatures will be IDENTICAL because timestamp is not part of the signed content
      // This is a known security limitation documented in MVP_SPEC.md
      expect(headers1["X-CMVH-Signature"]).toBe(headers2["X-CMVH-Signature"]);
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
        ...email,
        timestamp: futureTimestamp,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...email,
        timestamp: oldTimestamp,
      });

      const result = await verifyCMVHHeaders({
        headers,
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
        ...email,
      });

      // Try swapping from/to addresses
      const swappedResult = await verifyCMVHHeaders({
        headers,
        from: email.to,
        to: email.from,
        subject: email.subject,
        body: email.body,
      });

      expect(swappedResult.ok).toBe(false);

      // Try moving subject to body
      const movedResult = await verifyCMVHHeaders({
        headers,
        from: email.from,
        to: email.to,
        subject: email.body,
        body: email.subject,
      });

      expect(movedResult.ok).toBe(false);
    });

    it("should verify canonicalization order is strictly enforced", () => {
      const email = {
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Test",
        body: "Content",
      };

      const canonical = canonicalizeEmail(email);

      // Order must be: subject, from, to, body
      const expected = `${email.subject}\n${email.from}\n${email.to}\n${email.body}`;
      expect(canonical).toBe(expected);

      // Wrong order should produce different hash
      const wrongOrder = `${email.from}\n${email.to}\n${email.subject}\n${email.body}`;
      expect(canonical).not.toBe(wrongOrder);
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
        ...email,
      });

      // Format with extra spaces
      const rawWithSpaces = `
X-CMVH-Version:    1
X-CMVH-Address:   ${headers["X-CMVH-Address"]}
X-CMVH-Chain:  ${headers["X-CMVH-Chain"]}
X-CMVH-Timestamp:${headers["X-CMVH-Timestamp"]}
X-CMVH-HashAlgo: ${headers["X-CMVH-HashAlgo"]}
X-CMVH-Signature: ${headers["X-CMVH-Signature"]}
      `;

      const parsed = parseRawHeaders(rawWithSpaces);
      const result = await verifyCMVHHeaders({
        headers: parsed,
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
        ...email,
      });

      expect(result.ok).toBe(true);
    });
  });
});
