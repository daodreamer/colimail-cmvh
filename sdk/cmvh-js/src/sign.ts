/**
 * CMVH Email Signing
 */

import type { SignEmailInput, CMVHHeaders } from "./types.js";
import { canonicalizeEmail, validateEmailContent } from "./canonicalize.js";
import { keccak256, signHash, isValidHex } from "./crypto.js";
import { CMVHValidationError } from "./errors.js";

/**
 * Sign an email and generate CMVH headers
 * 
 * @param input - Email content and signing parameters
 * @returns CMVH headers ready to inject into email
 * 
 * @example
 * ```ts
 * const headers = await signEmail({
 *   privateKey: "0xabcd...",
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Partnership Proposal",
 *   body: "Hello Bob, let's collaborate..."
 * });
 * 
 * // headers = {
 * //   "X-CMVH-Version": "1",
 * //   "X-CMVH-Address": "0x...",
 * //   ...
 * // }
 * ```
 */
export async function signEmail(input: SignEmailInput): Promise<CMVHHeaders> {
  // Validate input
  validateSignInput(input);
  
  const {
    privateKey,
    from,
    to,
    subject,
    body,
    timestamp = Math.floor(Date.now() / 1000),
    chain = "Arbitrum",
    ens,
    reward,
    proofURL,
  } = input;

  // Validate email content
  validateEmailContent({ from, to, subject, body });

  // Canonicalize email
  const canonical = canonicalizeEmail({ from, to, subject, body });

  // Hash canonical string
  const hash = keccak256(canonical);

  // Sign hash
  const signature = await signHash(hash, privateKey);

  // Derive address from private key for verification
  const address = await deriveAddress(privateKey);

  // Build headers
  const headers: CMVHHeaders = {
    "X-CMVH-Version": "1",
    "X-CMVH-Address": address,
    "X-CMVH-Chain": chain,
    "X-CMVH-Timestamp": timestamp.toString(),
    "X-CMVH-HashAlgo": "keccak256",
    "X-CMVH-Signature": signature,
  };

  // Add optional fields
  if (ens) headers["X-CMVH-ENS"] = ens;
  if (reward) headers["X-CMVH-Reward"] = reward;
  if (proofURL) headers["X-CMVH-ProofURL"] = proofURL;

  return headers;
}

/**
 * Validate signing input
 */
function validateSignInput(input: SignEmailInput): void {
  if (!input.privateKey) {
    throw new CMVHValidationError("Missing private key");
  }
  
  if (!isValidHex(input.privateKey)) {
    throw new CMVHValidationError("Invalid private key format (must be hex with 0x prefix)");
  }
  
  if (!input.from) {
    throw new CMVHValidationError("Missing 'from' field");
  }
  
  if (!input.to) {
    throw new CMVHValidationError("Missing 'to' field");
  }
  
  if (!input.subject) {
    throw new CMVHValidationError("Missing 'subject' field");
  }
  
  if (input.body === undefined || input.body === null) {
    throw new CMVHValidationError("Missing 'body' field");
  }
}

/**
 * Derive Ethereum address from private key
 */
async function deriveAddress(privateKey: string): Promise<`0x${string}`> {
  // For MVP, we'll sign a dummy message and recover the address
  // This is a common pattern for deriving address from private key
  const dummyHash = keccak256("derive-address");
  const signature = await signHash(dummyHash, privateKey as `0x${string}`);
  
  // Import recoverAddress from crypto
  const { recoverAddress } = await import("./crypto.js");
  return recoverAddress(dummyHash, signature);
}
