/**
 * ColiMail Verification Header (CMVH) SDK
 * 
 * Blockchain-based email authentication and verification
 * 
 * @packageDocumentation
 */

// Core functions
export { signEmail } from "./sign.js";
export { verifyCMVHHeaders, quickVerify } from "./verify.js";
export { canonicalizeEmail, validateEmailContent } from "./canonicalize.js";
export { parseRawHeaders, validateCMVHHeaders, formatCMVHHeaders } from "./headers.js";

// Crypto utilities
export { keccak256, recoverAddress, isValidAddress, isValidHex } from "./crypto.js";

// Types
export type {
  CMVHHeaders,
  SignEmailInput,
  EmailContent,
  VerificationResult,
  ParsedCMVHHeaders,
  RawHeaders,
  HexString,
  Address,
  HashAlgorithm,
  ChainName,
} from "./types.js";

export {
  SPEC_VERSION,
  LIB_VERSION,
  SUPPORTED_HASH_ALGOS,
  SUPPORTED_CHAINS,
} from "./types.js";

// Errors
export {
  CMVHError,
  CMVHValidationError,
  CMVHSignatureError,
  CMVHParseError,
} from "./errors.js";
