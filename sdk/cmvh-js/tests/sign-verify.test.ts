/**
 * Test suite for CMVH signing and verification
 */

import { describe, it, expect } from "vitest";
import { signEmail, verifyCMVHHeaders, canonicalizeEmail } from "../src/index.js";

describe("CMVH Signing and Verification", () => {
  const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testEmail = {
    from: "alice@example.com",
    to: "bob@example.com",
    subject: "Test Email",
    body: "Hello, this is a test message.",
  };

  it("should sign an email and generate valid CMVH headers", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
    });

    expect(headers["X-CMVH-Version"]).toBe("1");
    expect(headers["X-CMVH-Address"]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(headers["X-CMVH-Chain"]).toBe("Arbitrum");
    expect(headers["X-CMVH-HashAlgo"]).toBe("keccak256");
    expect(headers["X-CMVH-Signature"]).toMatch(/^0x[a-fA-F0-9]{130}$/);
    expect(headers["X-CMVH-Timestamp"]).toBeTruthy();
  });

  it("should verify a valid signature", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
    });

    expect(result.ok).toBe(true);
    expect(result.address).toBeTruthy();
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("should pass verification even with different body (body not signed)", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
    });

    // Body is not included in signature, so changing it should not affect verification
    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      body: "Different body content",
    });

    expect(result.ok).toBe(true);
    expect(result.address).toBeTruthy();
  });

  it("should fail verification with tampered subject", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      subject: "Different Subject",
    });

    expect(result.ok).toBe(false);
  });

  it("should canonicalize email correctly (without body)", () => {
    const canonical = canonicalizeEmail(testEmail);
    // CMVH v1.0 spec: only subject, from, to (body excluded)
    const expected = `${testEmail.subject}\n${testEmail.from}\n${testEmail.to}`;
    expect(canonical).toBe(expected);
    // Verify body is NOT included
    expect(canonical).not.toContain(testEmail.body);
  });

  it("should include optional ENS field", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      ens: "alice.eth",
    });

    expect(headers["X-CMVH-ENS"]).toBe("alice.eth");

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
    });

    expect(result.ok).toBe(true);
    expect(result.ens).toBe("alice.eth");
  });

  it("should include optional reward field", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      reward: "0.05 wACT",
    });

    expect(headers["X-CMVH-Reward"]).toBe("0.05 wACT");
  });

  it("should handle empty body", async () => {
    const emptyBodyEmail = { ...testEmail, body: "" };
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...emptyBodyEmail,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...emptyBodyEmail,
    });

    expect(result.ok).toBe(true);
  });

  it("should reject missing required fields", async () => {
    await expect(
      signEmail({
        privateKey: testPrivateKey,
        from: "",
        to: testEmail.to,
        subject: testEmail.subject,
        body: testEmail.body,
      })
    ).rejects.toThrow();
  });
});
