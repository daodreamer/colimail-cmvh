/**
 * Email Canonicalization for CMVH
 *
 * CMVH Spec v2.0 (EIP-712):
 * Uses abi.encode for collision-resistant hashing
 *
 * NOTE: Body is intentionally excluded to avoid HTML formatting issues.
 */

import { encodeAbiParameters } from "viem";
import type { EmailContent, HexString } from "./types.js";
import { keccak256 } from "./crypto.js";

/**
 * Hash email content using abi.encode (EIP-712 compatible)
 *
 * @param content - Email content (from, to, subject, body ignored)
 * @returns keccak256 hash of abi-encoded email fields
 *
 * @remarks
 * v2.0 Update: Uses abi.encode instead of string concatenation to prevent
 * collision attacks from embedded newlines or control characters.
 * The body field is intentionally excluded from canonicalization.
 *
 * @example
 * ```ts
 * const hash = hashEmail({
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Hello",
 *   body: "Test message"  // Body is ignored
 * });
 * // Returns: 0x... (32-byte hash)
 * ```
 */
export function hashEmail(content: EmailContent): HexString {
  const { subject, from, to } = content;

  // Use abi.encode for collision-resistant encoding
  // This matches the contract's hashEmail function
  const encoded = encodeAbiParameters(
    [{ type: 'string' }, { type: 'string' }, { type: 'string' }],
    [subject, from, to]
  );

  return keccak256(encoded);
}

/**
 * Validate email content before canonicalization
 *
 * @param content - Email content to validate
 * @throws {Error} If any required field is missing
 */
export function validateEmailContent(content: EmailContent): void {
  if (!content.from) {
    throw new Error("Missing required field: from");
  }
  if (!content.to) {
    throw new Error("Missing required field: to");
  }
  // Subject can be empty string, but must be defined
  if (content.subject === undefined || content.subject === null) {
    throw new Error("Missing required field: subject");
  }
  // Body is not validated since it's not used in canonicalization
  // but EmailContent type still requires it for compatibility
}
