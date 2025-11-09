/**
 * CMVH Email Verification
 */

import type { VerificationResult, ParsedCMVHHeaders, RawHeaders, CMVHHeaders } from "./types.js";
import { parseRawHeaders, validateCMVHHeaders } from "./headers.js";
import { canonicalizeEmail } from "./canonicalize.js";
import { keccak256, recoverAddress } from "./crypto.js";

/**
 * Verify CMVH headers against email body
 * 
 * @param headers - Raw headers or parsed CMVH headers
 * @param emailContent - Email content (from, to, subject, body)
 * @returns Verification result with recovered address
 * 
 * @example
 * ```ts
 * const result = await verifyCMVHHeaders({
 *   headers: emailHeaders,
 *   body: emailBody,
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Test"
 * });
 * 
 * if (result.ok) {
 *   console.log("✅ Verified from:", result.address);
 * }
 * ```
 */
export async function verifyCMVHHeaders(params: {
  headers: string | RawHeaders | ParsedCMVHHeaders | CMVHHeaders;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<VerificationResult> {
  try {
    const { headers: rawHeaders, from, to, subject, body } = params;

    // Parse headers if needed
    const headers = isParsedHeaders(rawHeaders)
      ? rawHeaders
      : parseRawHeaders(rawHeaders);

    // Validate required headers
    try {
      validateCMVHHeaders(headers);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Invalid headers",
      };
    }

    // Canonicalize email content
    const canonical = canonicalizeEmail({ from, to, subject, body });

    // Hash canonical string
    const hash = keccak256(canonical);

    // Recover address from signature
    const recoveredAddress = await recoverAddress(hash, headers.signature!);

    // Compare with claimed address
    const addressMatch = recoveredAddress.toLowerCase() === headers.address!.toLowerCase();

    if (!addressMatch) {
      return {
        ok: false,
        reason: `Address mismatch: recovered ${recoveredAddress}, claimed ${headers.address}`,
      };
    }

    // Success
    return {
      ok: true,
      address: recoveredAddress,
      ens: headers.ens,
      timestamp: headers.timestamp ? parseInt(headers.timestamp, 10) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Type guard to check if headers are already parsed
 */
function isParsedHeaders(
  headers: string | RawHeaders | ParsedCMVHHeaders | CMVHHeaders
): headers is ParsedCMVHHeaders {
  return (
    typeof headers === "object" &&
    !Array.isArray(headers) &&
    ("version" in headers || "address" in headers || "signature" in headers) &&
    // CMVHHeaders use "X-CMVH-*" keys, ParsedCMVHHeaders use lowercase field names
    !("X-CMVH-Version" in headers)
  );
}

/**
 * Quick verification for minimal use case (just check signature validity)
 * 
 * @param headers - CMVH headers
 * @param body - Email body only (assumes from/to/subject extracted from headers)
 * @returns True if signature is valid
 */
export async function quickVerify(
  headers: ParsedCMVHHeaders,
  canonicalString: string
): Promise<boolean> {
  try {
    validateCMVHHeaders(headers);
    
    const hash = keccak256(canonicalString);
    const recoveredAddress = await recoverAddress(hash, headers.signature!);
    
    return recoveredAddress.toLowerCase() === headers.address!.toLowerCase();
  } catch {
    return false;
  }
}
