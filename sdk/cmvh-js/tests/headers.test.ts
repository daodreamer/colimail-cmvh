/**
 * Test suite for header parsing
 */

import { describe, it, expect } from "vitest";
import { parseRawHeaders, formatCMVHHeaders, validateCMVHHeaders } from "../src/index.js";

describe("CMVH Header Parsing", () => {
  const validHeaders = {
    version: "1",
    address: "0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3" as `0x${string}`,
    chain: "Arbitrum" as const,
    timestamp: "1730733600",
    hashAlgo: "keccak256" as const,
    signature: "0xd54f3b8b9aae99" as `0x${string}`,
    ens: "alice.eth",
  };

  it("should parse headers from multiline string", () => {
    const raw = `
X-CMVH-Version: 1
X-CMVH-Address: 0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3
X-CMVH-Chain: Arbitrum
X-CMVH-Timestamp: 1730733600
X-CMVH-HashAlgo: keccak256
X-CMVH-Signature: 0xd54f3b8b9aae99
X-CMVH-ENS: alice.eth
    `;

    const parsed = parseRawHeaders(raw);

    expect(parsed.version).toBe("1");
    expect(parsed.address).toBe("0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3");
    expect(parsed.chain).toBe("Arbitrum");
    expect(parsed.ens).toBe("alice.eth");
  });

  it("should parse headers from object", () => {
    const raw = {
      "X-CMVH-Version": "1",
      "X-CMVH-Address": "0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3",
    };

    const parsed = parseRawHeaders(raw);

    expect(parsed.version).toBe("1");
    expect(parsed.address).toBe("0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3");
  });

  it("should handle case-insensitive headers", () => {
    const raw = {
      "x-cmvh-version": "1",
      "x-cmvh-address": "0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3",
    };

    const parsed = parseRawHeaders(raw);

    expect(parsed.version).toBe("1");
    expect(parsed.address).toBe("0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3");
  });

  it("should format headers as multiline string", () => {
    const formatted = formatCMVHHeaders(validHeaders);

    expect(formatted).toContain("X-CMVH-Version: 1");
    expect(formatted).toContain("X-CMVH-Address: 0x53dA9B0a33C6EfE3b26A0B31d8a4eEa2f9E8B9b3");
    expect(formatted).toContain("X-CMVH-ENS: alice.eth");
  });

  it("should validate required headers", () => {
    expect(() => validateCMVHHeaders(validHeaders)).not.toThrow();
  });

  it("should reject missing required fields", () => {
    const invalid = { ...validHeaders };
    delete (invalid as any).signature;

    expect(() => validateCMVHHeaders(invalid)).toThrow("Missing required");
  });

  it("should reject unsupported version", () => {
    const invalid = { ...validHeaders, version: "2" };

    expect(() => validateCMVHHeaders(invalid)).toThrow("Unsupported CMVH version");
  });

  it("should reject unsupported hash algorithm", () => {
    const invalid = { ...validHeaders, hashAlgo: "sha256" as any };

    expect(() => validateCMVHHeaders(invalid)).toThrow("Unsupported hash algorithm");
  });
});
