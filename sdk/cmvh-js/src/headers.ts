/**
 * CMVH Header Parsing and Extraction
 */

import type { ParsedCMVHHeaders, RawHeaders, Address, HexString, CMVHHeaders } from "./types.js";
import { CMVHParseError } from "./errors.js";

/**
 * Parse raw email headers and extract CMVH fields
 * 
 * @param rawHeaders - Raw headers as key-value pairs or multiline string
 * @returns Parsed CMVH headers object
 * 
 * @example
 * ```ts
 * const headers = parseRawHeaders(`
 * From: alice@gmail.com
 * X-CMVH-Version: 1
 * X-CMVH-Address: 0x1234...
 * `);
 * ```
 */
export function parseRawHeaders(rawHeaders: string | RawHeaders | CMVHHeaders): ParsedCMVHHeaders {
  const headers = typeof rawHeaders === "string" 
    ? parseHeaderString(rawHeaders) 
    : rawHeaders;

  return {
    version: headers["X-CMVH-Version"] || headers["x-cmvh-version"],
    address: (headers["X-CMVH-Address"] || headers["x-cmvh-address"]) as Address | undefined,
    chain: headers["X-CMVH-Chain"] || headers["x-cmvh-chain"] as any,
    timestamp: headers["X-CMVH-Timestamp"] || headers["x-cmvh-timestamp"],
    hashAlgo: headers["X-CMVH-HashAlgo"] || headers["x-cmvh-hashalgo"] as any,
    signature: (headers["X-CMVH-Signature"] || headers["x-cmvh-signature"]) as HexString | undefined,
    ens: headers["X-CMVH-ENS"] || headers["x-cmvh-ens"],
    reward: headers["X-CMVH-Reward"] || headers["x-cmvh-reward"],
    proofURL: headers["X-CMVH-ProofURL"] || headers["x-cmvh-proofurl"],
  };
}

/**
 * Parse multiline header string into key-value pairs
 */
function parseHeaderString(raw: string): RawHeaders {
  const headers: RawHeaders = {};
  const lines = raw.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(":")) continue;
    
    const colonIndex = trimmed.indexOf(":");
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    
    // Only take first occurrence of each header
    if (!headers[key]) {
      headers[key] = value;
    }
  }
  
  return headers;
}

/**
 * Validate that required CMVH headers are present
 * 
 * @throws {CMVHParseError} If required headers are missing
 */
export function validateCMVHHeaders(headers: ParsedCMVHHeaders): void {
  const required = ["version", "address", "timestamp", "hashAlgo", "signature"] as const;
  
  for (const field of required) {
    if (!headers[field]) {
      throw new CMVHParseError(`Missing required CMVH header: ${field}`);
    }
  }
  
  // Validate version (support v1 and v2)
  if (headers.version !== "1" && headers.version !== "2") {
    throw new CMVHParseError(`Unsupported CMVH version: ${headers.version}. Supported versions: 1, 2`);
  }
  
  // Validate hash algorithm
  if (headers.hashAlgo !== "keccak256") {
    throw new CMVHParseError(`Unsupported hash algorithm: ${headers.hashAlgo}`);
  }
}

/**
 * Format CMVH headers as email header lines
 *
 * @param headers - Parsed CMVH headers or CMVHHeaders
 * @returns Multiline string ready to inject into email
 *
 * @example
 * ```ts
 * const formatted = formatCMVHHeaders(headers);
 * // Returns:
 * // X-CMVH-Version: 1
 * // X-CMVH-Address: 0x1234...
 * // ...
 * ```
 */
export function formatCMVHHeaders(headers: ParsedCMVHHeaders | CMVHHeaders): string {
  // Convert CMVHHeaders format to ParsedCMVHHeaders format if needed
  let parsed: ParsedCMVHHeaders;

  if ("X-CMVH-Version" in headers) {
    // CMVHHeaders format
    const cmvhHeaders = headers as CMVHHeaders;
    parsed = {
      version: cmvhHeaders["X-CMVH-Version"],
      address: cmvhHeaders["X-CMVH-Address"],
      chain: cmvhHeaders["X-CMVH-Chain"],
      timestamp: cmvhHeaders["X-CMVH-Timestamp"],
      hashAlgo: cmvhHeaders["X-CMVH-HashAlgo"],
      signature: cmvhHeaders["X-CMVH-Signature"],
      ens: cmvhHeaders["X-CMVH-ENS"],
      reward: cmvhHeaders["X-CMVH-Reward"],
      proofURL: cmvhHeaders["X-CMVH-ProofURL"],
    };
  } else {
    // Already ParsedCMVHHeaders format
    parsed = headers as ParsedCMVHHeaders;
  }
  const lines: string[] = [];

  if (parsed.version) lines.push(`X-CMVH-Version: ${parsed.version}`);
  if (parsed.address) lines.push(`X-CMVH-Address: ${parsed.address}`);
  if (parsed.chain) lines.push(`X-CMVH-Chain: ${parsed.chain}`);
  if (parsed.timestamp) lines.push(`X-CMVH-Timestamp: ${parsed.timestamp}`);
  if (parsed.hashAlgo) lines.push(`X-CMVH-HashAlgo: ${parsed.hashAlgo}`);
  if (parsed.signature) lines.push(`X-CMVH-Signature: ${parsed.signature}`);
  if (parsed.ens) lines.push(`X-CMVH-ENS: ${parsed.ens}`);
  if (parsed.reward) lines.push(`X-CMVH-Reward: ${parsed.reward}`);
  if (parsed.proofURL) lines.push(`X-CMVH-ProofURL: ${parsed.proofURL}`);

  return lines.join("\n");
}
