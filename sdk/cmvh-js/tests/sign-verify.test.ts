/**
 * Test suite for CMVH signing and verification (EIP-712 v2.0)
 */

import { describe, it, expect } from "vitest";
import { signEmail, verifyCMVHHeaders } from "../src/index.js";

describe("CMVH Signing and Verification (EIP-712 v2.0)", () => {
  const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testEmail = {
    from: "alice@example.com",
    to: "bob@example.com",
    subject: "Test Email",
    body: "Hello, this is a test message.",
  };
  const testChainId = 42161; // Arbitrum
  const testVerifyingContract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

  it("should sign an email and generate valid CMVH headers", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    expect(headers["X-CMVH-Version"]).toBe("2");
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
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    expect(result.ok).toBe(true);
    expect(result.address).toBeTruthy();
    expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("should pass verification even with different body (body not signed)", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    // Body is not included in signature, so changing it should not affect verification
    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      body: "Different body content",
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    expect(result.ok).toBe(true);
    expect(result.address).toBeTruthy();
  });

  it("should fail verification with tampered subject", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      subject: "Different Subject",
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    expect(result.ok).toBe(false);
  });

  it("should include optional ENS field", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
      ens: "alice.eth",
    });

    expect(headers["X-CMVH-ENS"]).toBe("alice.eth");

    const result = await verifyCMVHHeaders({
      headers,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    expect(result.ok).toBe(true);
    expect(result.ens).toBe("alice.eth");
  });

  it("should include optional reward field", async () => {
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...testEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
      reward: "0.05 wACT",
    });

    expect(headers["X-CMVH-Reward"]).toBe("0.05 wACT");
  });

  it("should handle empty body", async () => {
    const emptyBodyEmail = { ...testEmail, body: "" };
    const headers = await signEmail({
      privateKey: testPrivateKey,
      ...emptyBodyEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
    });

    const result = await verifyCMVHHeaders({
      headers,
      ...emptyBodyEmail,
      chainId: testChainId,
      verifyingContract: testVerifyingContract,
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
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
      })
    ).rejects.toThrow();
  });

  it("should reject missing verifyingContract", async () => {
    await expect(
      signEmail({
        privateKey: testPrivateKey,
        ...testEmail,
        chainId: testChainId,
      })
    ).rejects.toThrow("Missing verifyingContract");
  });
});
