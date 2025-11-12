/**
 * Email Canonicalization for CMVH
 *
 * CMVH Spec v1.0:
 * canonical = SUBJECT + "\n" + FROM + "\n" + TO
 *
 * NOTE: Body is intentionally excluded to avoid HTML formatting issues.
 * This matches the production implementation in ColiMail client (Rust).
 */

import type { EmailContent } from "./types.js";

/**
 * Canonicalize email content into deterministic string
 *
 * @param content - Email content (from, to, subject, body ignored)
 * @returns Canonical string ready for hashing
 *
 * @remarks
 * The body field is intentionally excluded from canonicalization to avoid
 * issues with HTML formatting, whitespace normalization, and encoding differences.
 * Only metadata (subject, from, to) is signed.
 *
 * @example
 * ```ts
 * const canonical = canonicalizeEmail({
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Hello",
 *   body: "Test message"  // Body is ignored in canonicalization
 * });
 * // Returns: "Hello\nalice@gmail.com\nbob@outlook.com"
 * ```
 */
export function canonicalizeEmail(content: EmailContent): string {
  const { subject, from, to } = content;

  // Simple concatenation with newline separators
  // Order: subject, from, to (body excluded by design)
  return `${subject}\n${from}\n${to}`;
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
