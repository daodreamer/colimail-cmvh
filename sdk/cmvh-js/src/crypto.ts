/**
 * Cryptographic utilities for CMVH
 */

import { keccak_256 } from "@noble/hashes/sha3.js";
import { privateKeyToAccount } from "viem/accounts";
import { encodeAbiParameters, encodePacked } from "viem";
import type { HexString, Address } from "./types.js";

/**
 * EIP-712 Domain constants
 */
export const EIP712_DOMAIN = {
  name: "CMVHVerifier",
  version: "2.0.0",
  // chainId and verifyingContract are set dynamically
} as const;

/**
 * EIP-712 Type hashes
 */
export const DOMAIN_TYPEHASH = keccak256(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

export const EMAIL_TYPEHASH = keccak256(
  "Email(string subject,string from,string to,uint256 timestamp)"
);

/**
 * Hash data using keccak256
 * 
 * @param data - String or Uint8Array to hash
 * @returns Hex-encoded hash with 0x prefix
 */
export function keccak256(data: string | Uint8Array): HexString {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = keccak_256(bytes);
  return `0x${bytesToHex(hash)}` as HexString;
}

/**
 * Sign a hash with a private key
 * 
 * @param hash - 32-byte hash to sign (with or without 0x prefix)
 * @param privateKey - Private key (with or without 0x prefix)
 * @returns Signature as hex string with 0x prefix (130 hex chars = 65 bytes)
 */
export async function signHash(hash: HexString, privateKey: HexString): Promise<HexString> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  // Sign the hash directly (raw bytes)
  const signature = await account.sign({
    hash: hash as `0x${string}`
  });
  
  return signature as HexString;
}

/**
 * Recover address from signature and hash
 * 
 * @param hash - Original hash that was signed
 * @param signature - Signature with recovery bit
 * @returns Recovered Ethereum address
 */
export async function recoverAddress(hash: HexString, signature: HexString): Promise<Address> {
  // Use viem's recover address utility
  const { recoverAddress: viemRecover } = await import("viem");
  
  const address = await viemRecover({
    hash: hash as `0x${string}`,
    signature: signature as `0x${string}`
  });
  
  return address as Address;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validate hex string format
 */
export function isValidHex(hex: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(hex);
}

/**
 * Get EIP-712 domain separator
 *
 * @param chainId - Chain ID (e.g., 1 for Ethereum mainnet, 42161 for Arbitrum)
 * @param verifyingContract - Contract address
 * @returns Domain separator hash
 */
export function getDomainSeparator(chainId: number, verifyingContract: Address): HexString {
  const domainData = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'address' }
    ],
    [
      DOMAIN_TYPEHASH as `0x${string}`,
      keccak256(EIP712_DOMAIN.name) as `0x${string}`,
      keccak256(EIP712_DOMAIN.version) as `0x${string}`,
      BigInt(chainId),
      verifyingContract as `0x${string}`
    ]
  );

  return keccak256(domainData);
}

/**
 * Get EIP-712 struct hash for email
 *
 * @param subject - Email subject
 * @param from - Email from address
 * @param to - Email to address
 * @param timestamp - Unix timestamp in seconds
 * @returns Email struct hash
 */
export function getEmailStructHash(subject: string, from: string, to: string, timestamp: number): HexString {
  const structData = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' }
    ],
    [
      EMAIL_TYPEHASH as `0x${string}`,
      keccak256(subject) as `0x${string}`,
      keccak256(from) as `0x${string}`,
      keccak256(to) as `0x${string}`,
      BigInt(timestamp)
    ]
  );

  return keccak256(structData);
}

/**
 * Create EIP-712 digest for signing
 *
 * @param domainSeparator - Domain separator from getDomainSeparator
 * @param structHash - Struct hash from getEmailStructHash
 * @returns EIP-712 compliant digest ready for signing
 */
export function getEIP712Digest(domainSeparator: HexString, structHash: HexString): HexString {
  const packed = encodePacked(
    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
    ['0x19', '0x01', domainSeparator as `0x${string}`, structHash as `0x${string}`]
  );

  return keccak256(packed);
}
