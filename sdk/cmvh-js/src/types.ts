/**
 * CMVH Type Definitions
 * Spec Version: 1.0.0
 */

export const SPEC_VERSION = "1.0.0";
export const LIB_VERSION = "1.0.0";

export type HexString = `0x${string}`;
export type Address = HexString;

/**
 * Supported hash algorithms for CMVH
 */
export const SUPPORTED_HASH_ALGOS = ["keccak256"] as const;
export type HashAlgorithm = typeof SUPPORTED_HASH_ALGOS[number];

/**
 * Supported blockchain networks
 */
export const SUPPORTED_CHAINS = ["Arbitrum", "Ethereum", "ArbitrumSepolia"] as const;
export type ChainName = typeof SUPPORTED_CHAINS[number];

/**
 * CMVH Header set returned by signing
 */
export interface CMVHHeaders extends Record<string, string | undefined> {
  "X-CMVH-Version": string;
  "X-CMVH-Address": Address;
  "X-CMVH-Chain": ChainName;
  "X-CMVH-Timestamp": string;
  "X-CMVH-HashAlgo": HashAlgorithm;
  "X-CMVH-Signature": HexString;
  "X-CMVH-ENS"?: string;
  "X-CMVH-Reward"?: string;
  "X-CMVH-ProofURL"?: string;
}

/**
 * Input for email signing
 */
export interface SignEmailInput {
  privateKey: HexString;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp?: number;
  chain?: ChainName;
  ens?: string;
  reward?: string;
  proofURL?: string;
}

/**
 * Email content for canonicalization
 */
export interface EmailContent {
  from: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  ok: boolean;
  address?: Address;
  ens?: string;
  timestamp?: number;
  reason?: string;
}

/**
 * Parsed CMVH headers from raw email
 */
export interface ParsedCMVHHeaders {
  version?: string;
  address?: Address;
  chain?: ChainName;
  timestamp?: string;
  hashAlgo?: HashAlgorithm;
  signature?: HexString;
  ens?: string;
  reward?: string;
  proofURL?: string;
}

/**
 * Raw email headers as key-value pairs
 */
export type RawHeaders = Record<string, string>;
