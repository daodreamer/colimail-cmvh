/**
 * Cryptographic utilities for CMVH
 */

import { keccak_256 } from "@noble/hashes/sha3.js";
import { privateKeyToAccount } from "viem/accounts";
import type { HexString, Address } from "./types.js";

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
