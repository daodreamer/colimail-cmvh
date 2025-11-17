/**
 * CMVH Email Verification (EIP-712 v2.0)
 */

import type { VerificationResult, ParsedCMVHHeaders, RawHeaders, CMVHHeaders, Address } from "./types.js";
import { parseRawHeaders, validateCMVHHeaders } from "./headers.js";
import {
  recoverAddress,
  getDomainSeparator,
  getEmailStructHash,
  getEIP712Digest
} from "./crypto.js";

/**
 * Verify CMVH headers against email body with EIP-712
 *
 * @param headers - Raw headers or parsed CMVH headers
 * @param emailContent - Email content (from, to, subject, body)
 * @param chainId - Chain ID (required for EIP-712)
 * @param verifyingContract - Contract address (required for EIP-712)
 * @returns Verification result with recovered address
 *
 * @example
 * ```ts
 * const result = await verifyCMVHHeaders({
 *   headers: emailHeaders,
 *   body: emailBody,
 *   from: "alice@gmail.com",
 *   to: "bob@outlook.com",
 *   subject: "Test",
 *   chainId: 42161,
 *   verifyingContract: "0x..."
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
  chainId?: number;
  verifyingContract?: Address;
}): Promise<VerificationResult> {
  try {
    const {
      headers: rawHeaders,
      from,
      to,
      subject,
      chainId,
      verifyingContract
    } = params;

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

    // Check version and use appropriate verification method
    const version = headers.version || "1";

    if (version === "2") {
      // EIP-712 verification (v2.0)
      if (!chainId || !verifyingContract) {
        return {
          ok: false,
          reason: "Missing chainId or verifyingContract for EIP-712 verification (v2.0)",
        };
      }

      // Get timestamp from headers
      const timestamp = headers.timestamp ? parseInt(headers.timestamp, 10) : 0;

      // Get EIP-712 struct hash (includes timestamp for replay protection)
      const emailStructHash = getEmailStructHash(subject, from, to, timestamp);

      // Get domain separator
      const domainSeparator = getDomainSeparator(chainId, verifyingContract);

      // Create EIP-712 digest
      const digest = getEIP712Digest(domainSeparator, emailStructHash);

      // Recover address from signature
      const recoveredAddress = await recoverAddress(digest, headers.signature!);

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
    } else {
      // Legacy verification (v1.0) - for backward compatibility
      // Note: This is deprecated and should not be used for new signatures
      return {
        ok: false,
        reason: "Legacy v1.0 signatures are no longer supported. Please use v2.0 with EIP-712.",
      };
    }
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
 * @param subject - Email subject
 * @param from - Email from
 * @param to - Email to
 * @param chainId - Chain ID (required for EIP-712 v2.0)
 * @param verifyingContract - Contract address (required for EIP-712 v2.0)
 * @returns True if signature is valid
 */
export async function quickVerify(
  headers: ParsedCMVHHeaders,
  subject: string,
  from: string,
  to: string,
  chainId?: number,
  verifyingContract?: Address
): Promise<boolean> {
  try {
    validateCMVHHeaders(headers);

    const version = headers.version || "1";

    if (version === "2") {
      if (!chainId || !verifyingContract) {
        return false;
      }

      // Get timestamp from headers
      const timestamp = headers.timestamp ? parseInt(headers.timestamp, 10) : 0;

      // EIP-712 verification (includes timestamp for replay protection)
      const emailStructHash = getEmailStructHash(subject, from, to, timestamp);
      const domainSeparator = getDomainSeparator(chainId, verifyingContract);
      const digest = getEIP712Digest(domainSeparator, emailStructHash);
      const recoveredAddress = await recoverAddress(digest, headers.signature!);

      return recoveredAddress.toLowerCase() === headers.address!.toLowerCase();
    } else {
      // Legacy v1.0 not supported
      return false;
    }
  } catch {
    return false;
  }
}
