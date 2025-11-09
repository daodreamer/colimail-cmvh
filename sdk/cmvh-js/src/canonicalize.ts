/**
 * Email Canonicalization for CMVH
 * 
 * MVP Spec:
 * canonical = SUBJECT + "\n" + FROM + "\n" + TO + "\n" + BODY
 */

import type { EmailContent } from "./types.js";

/**
 * Canonicalize email content into deterministic string
 * 
 * @param content - Email content (from, to, subject, body)
 * @returns Canonical string ready for hashing
 * 
 * @example
 * ```ts
 * const canonical = canonicalizeEmail({
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Hello",
 *   body: "Test message"
 * });
 * // Returns: "Hello\nalice@gmail.com\nbob@outlook.com\nTest message"
 * ```
 */
export function canonicalizeEmail(content: EmailContent): string {
  const { subject, from, to, body } = content;
  
  // Simple concatenation with newline separators
  // Order: subject, from, to, body
  return `${subject}\n${from}\n${to}\n${body}`;
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
  if (!content.subject) {
    throw new Error("Missing required field: subject");
  }
  if (content.body === undefined || content.body === null) {
    throw new Error("Missing required field: body");
  }
}
