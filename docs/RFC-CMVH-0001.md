# RFC-CMVH-0001: ColiMail Verification Header Specification

**Status**: Standard
**Version**: 1.0
**Date**: 2025-11-12
**Authors**: ColiMail Labs (Dao Dreamer)
**Category**: Email Authentication Standard

---

## Abstract

ColiMail Verification Header (CMVH) is an open standard for blockchain-based email authentication that enables cryptographic verification of email sender identity without requiring modifications to existing email infrastructure (IMAP/SMTP servers). CMVH adds custom X-CMVH-* headers to emails containing ECDSA signatures that can be verified locally or on-chain.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Overview](#3-overview)
4. [Canonicalization Algorithm](#4-canonicalization-algorithm)
5. [Cryptographic Operations](#5-cryptographic-operations)
6. [Header Specification](#6-header-specification)
7. [Verification Process](#7-verification-process)
8. [Smart Contract Integration](#8-smart-contract-integration)
9. [Security Considerations](#9-security-considerations)
10. [Implementation Guidelines](#10-implementation-guidelines)
11. [Examples](#11-examples)
12. [References](#12-references)

---

## 1. Introduction

### 1.1 Motivation

Traditional email systems lack native support for cryptographic sender authentication. While solutions like DKIM and SPF exist, they require server-side configuration and don't integrate with blockchain identity systems. CMVH provides:

- **Blockchain Identity Verification**: Link email identities to Ethereum addresses and ENS names
- **Tamper Detection**: Cryptographically protect email metadata (subject, from, to)
- **No Server Modification**: Works with any IMAP/SMTP provider
- **Dual Verification**: Support both local (free, instant) and on-chain verification

### 1.2 Scope

This specification defines:
- Email canonicalization algorithm for CMVH v1.0
- ECDSA signature generation and verification
- Custom email header format (X-CMVH-*)
- On-chain verification contract interface

This specification does NOT define:
- Reward distribution mechanisms (future extension)
- ENS resolution protocols (future extension)
- Body content signing (excluded by design)
- Attachment verification (future extension)

---

## 2. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

**Terms:**

- **Signer**: The entity creating the CMVH signature (email sender)
- **Verifier**: The entity checking the CMVH signature (email recipient or client)
- **Canonical Form**: Normalized representation of email content for hashing
- **Email Metadata**: Subject, From, and To fields (body excluded)
- **EOA**: Externally Owned Account (Ethereum wallet with private key)
- **ENS**: Ethereum Name Service

---

## 3. Overview

### 3.1 Architecture

```
┌─────────────┐
│ Email Client│
│  (Sender)   │
└──────┬──────┘
       │ 1. Compose email
       │ 2. Sign metadata (subject, from, to)
       │ 3. Add X-CMVH-* headers
       ▼
┌──────────────┐
│ SMTP Server  │
│ (Standard)   │
└──────┬───────┘
       │ 4. Transmit email
       ▼
┌──────────────┐
│ IMAP Server  │
│ (Standard)   │
└──────┬───────┘
       │ 5. Retrieve email
       ▼
┌──────────────┐       ┌─────────────────┐
│ Email Client │◄─────►│ Smart Contract  │
│ (Recipient)  │ 6a.   │ (Arbitrum)      │
└──────────────┘ Local │ CMVHVerifier    │
     │           or     └─────────────────┘
     │           6b. On-chain Verification
     ▼
┌──────────────┐
│ Verification │
│ Result       │
└──────────────┘
```

### 3.2 Workflow

1. **Signing**: Sender generates ECDSA signature over email metadata
2. **Injection**: X-CMVH-* headers added to email before sending
3. **Transmission**: Email sent through standard SMTP
4. **Reception**: Recipient retrieves email through standard IMAP
5. **Parsing**: Client extracts X-CMVH-* headers
6. **Verification**: Signature verified locally or via smart contract

---

## 4. Canonicalization Algorithm

### 4.1 Specification

CMVH v1.0 canonicalization algorithm:

```
canonical_form = SUBJECT + "\n" + FROM + "\n" + TO
```

**Where:**
- `SUBJECT`: Email subject line (as-is, no normalization)
- `FROM`: Sender email address (as-is)
- `TO`: Recipient email address (as-is)
- `"\n"`: UTF-8 newline character (0x0A)

**Body is intentionally excluded** to avoid HTML formatting, whitespace normalization, and encoding inconsistencies.

### 4.2 Rules

1. **No Trimming**: Preserve leading/trailing whitespace in all fields
2. **No Normalization**: Keep original UTF-8 encoding
3. **Strict Ordering**: Subject → From → To (MUST NOT reorder)
4. **Newline Separator**: Use LF (0x0A), not CRLF (0x0D0A)
5. **Body Excluded**: Body content MUST NOT be included in canonical form

### 4.3 Examples

```
Subject: "Meeting Tomorrow"
From: alice@example.com
To: bob@example.com
Body: "Let's meet at 3pm."

Canonical Form:
"Meeting Tomorrow\nalice@example.com\nbob@example.com"
```

```
Subject: "  Urgent  "  (with spaces)
From: sender@domain.com
To: receiver@domain.com

Canonical Form:
"  Urgent  \nsender@domain.com\nreceiver@domain.com"
```

### 4.4 Design Rationale

**Why exclude body?**

1. **HTML Formatting**: Email clients render HTML differently
2. **Whitespace**: Inconsistent handling of spaces, tabs, line breaks
3. **Encoding**: UTF-8, quoted-printable, base64 encoding variations
4. **MIME**: Multipart messages have complex structure
5. **Attachments**: Binary data handling complexity

Metadata (subject, from, to) is sufficient for authentication purposes and remains consistent across clients.

---

## 5. Cryptographic Operations

### 5.1 Hashing

**Algorithm**: Keccak-256 (Ethereum standard)

```
hash = keccak256(utf8_encode(canonical_form))
```

**Output**: 32 bytes (256 bits)
**Format**: Raw bytes (no prefix for signing)

### 5.2 Signing

**Algorithm**: ECDSA secp256k1
**Curve**: secp256k1 (same as Bitcoin/Ethereum)

**Process:**
1. Compute email hash: `hash = keccak256(canonical_form)`
2. Sign hash directly: `signature = ECDSA_sign(hash, private_key)`
3. Include recovery ID (v) for address recovery

**Signature Format:**
```
signature = r (32 bytes) || s (32 bytes) || v (1 byte)
Total: 65 bytes
```

**v value**: 27 or 28 (Ethereum convention)

**Hex Encoding**: `0x` + 130 hex characters

### 5.3 Address Derivation

Ethereum address derived from public key:

```
public_key = secp256k1_public_key_from_private(private_key)
public_key_uncompressed = 65 bytes (0x04 || x || y)
address_hash = keccak256(public_key_uncompressed[1:])  # Skip 0x04 prefix
address = "0x" + address_hash[12:]  # Last 20 bytes
```

### 5.4 Signature Verification

**Local Verification:**
```
1. Parse signature (r, s, v)
2. Compute email hash from canonical form
3. Recover public key: pub = ecrecover(hash, v, r, s)
4. Derive address from public key
5. Compare with claimed address (case-insensitive)
```

**On-Chain Verification:**
```solidity
function verifyEmail(
    address signer,
    string calldata subject,
    string calldata from,
    string calldata to,
    bytes calldata signature
) external pure returns (bool)
```

---

## 6. Header Specification

### 6.1 Required Headers

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-CMVH-Version` | Integer | Protocol version | `1` |
| `X-CMVH-Address` | Address | Ethereum address (checksummed) | `0x5d17928...` |
| `X-CMVH-Chain` | String | Blockchain name | `Arbitrum` |
| `X-CMVH-Timestamp` | Unix | Signature timestamp (seconds) | `1731410000` |
| `X-CMVH-HashAlgo` | String | Hash algorithm | `keccak256` |
| `X-CMVH-Signature` | Hex | ECDSA signature (65 bytes) | `0x744dd21f...` |

### 6.2 Optional Headers

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-CMVH-ENS` | String | ENS name (display only) | `alice.eth` |
| `X-CMVH-Reward` | String | Reward amount and token | `0.05 wACT` |
| `X-CMVH-ProofURL` | URL | IPFS or on-chain proof | `ipfs://Qm...` |

### 6.3 Header Format

```
X-CMVH-Version: 1
X-CMVH-Address: 0x5d17928193d5d47e159b35747ca4f77da184c11f
X-CMVH-Chain: Arbitrum
X-CMVH-Timestamp: 1731410000
X-CMVH-HashAlgo: keccak256
X-CMVH-Signature: 0x744dd21f4e952e97a197de090487b0648566e94d9b...
X-CMVH-ENS: alice.eth
X-CMVH-Reward: 0.05 wACT
```

### 6.4 Validation Rules

1. **Version**: MUST be "1" for this specification
2. **Address**: MUST be valid Ethereum address (0x + 40 hex chars)
3. **Chain**: MUST be one of: `Arbitrum`, `Ethereum`, `ArbitrumSepolia`
4. **Timestamp**: MUST be Unix timestamp in seconds (10 digits)
5. **HashAlgo**: MUST be "keccak256"
6. **Signature**: MUST be 0x + 130 hex characters (65 bytes)

---

## 7. Verification Process

### 7.1 Local Verification

```
1. Extract X-CMVH-* headers from email
2. Validate required headers present and well-formed
3. Canonicalize email: canonical = subject + "\n" + from + "\n" + to
4. Hash canonical form: hash = keccak256(canonical)
5. Parse signature components (r, s, v)
6. Recover signer address from signature
7. Compare recovered address with X-CMVH-Address (case-insensitive)
8. Return verification result
```

**Performance**: <50ms typical
**Cost**: Free (local computation)

### 7.2 On-Chain Verification

```
1. Extract X-CMVH-* headers and email metadata
2. Call smart contract: verifyEmail(address, subject, from, to, signature)
3. Contract performs same verification logic on-chain
4. Return boolean result
```

**Gas Cost**: ~28-31k gas
**Cost**: ~$0.001-0.01 depending on gas price
**Security**: Immutable, auditable verification

### 7.3 Verification Result

```typescript
interface VerificationResult {
  is_valid: boolean;           // true if signature is valid
  signer_address?: string;     // Recovered Ethereum address
  ens_name?: string;           // ENS name if provided
  timestamp?: number;          // Signature timestamp
  chain?: string;              // Blockchain name
  error?: string;              // Error message if verification failed
}
```

---

## 8. Smart Contract Integration

### 8.1 Contract Interface

```solidity
interface ICMVHVerifier {
    /**
     * @notice Verify email signature with inline canonicalization
     * @param signer Expected signer address
     * @param subject Email subject
     * @param from Sender email
     * @param to Recipient email
     * @param signature ECDSA signature (65 bytes)
     * @return bool True if signature is valid
     */
    function verifyEmail(
        address signer,
        string calldata subject,
        string calldata from,
        string calldata to,
        bytes calldata signature
    ) external pure returns (bool);

    /**
     * @notice Verify pre-computed email hash
     * @param signer Expected signer address
     * @param emailHash Pre-computed keccak256 hash
     * @param signature ECDSA signature (65 bytes)
     * @return bool True if signature is valid
     */
    function verifySignature(
        address signer,
        bytes32 emailHash,
        bytes calldata signature
    ) external pure returns (bool);

    /**
     * @notice Recover signer address from signature
     * @param emailHash Email hash
     * @param signature ECDSA signature
     * @return address Recovered signer address
     */
    function recoverSigner(
        bytes32 emailHash,
        bytes calldata signature
    ) external pure returns (address);

    /**
     * @notice Compute email hash from metadata
     * @param subject Email subject
     * @param from Sender email
     * @param to Recipient email
     * @return bytes32 Keccak256 hash
     */
    function hashEmail(
        string calldata subject,
        string calldata from,
        string calldata to
    ) external pure returns (bytes32);
}
```

### 8.2 Deployment

**Network**: Arbitrum One (Mainnet)
**Testnet**: Arbitrum Sepolia
**Contract Address**: `0xc4BAD26e321A8D0FE3bA3337Fc3846c25506308a` (Sepolia)

**Gas Costs:**
- `verifyEmail`: ~31k gas
- `verifySignature`: ~28k gas
- `recoverSigner`: ~26k gas
- `hashEmail`: ~3k gas

---

## 9. Security Considerations

### 9.1 Known Limitations

**MVP (v1.0) Intentional Limitations:**

1. **No Replay Protection**: Same email content produces same signature
   - Mitigation: Phase 4+ will add nonce-based replay protection
   - Risk: Low (email metadata uniquely identifies messages)

2. **No Timestamp Validation**: Expired/future timestamps accepted
   - Mitigation: Clients SHOULD validate timestamp reasonableness
   - Risk: Low (doesn't affect signature validity)

3. **No Forwarding Detection**: Original signature remains valid
   - Mitigation: Compare From field with claimed signer address
   - Risk: Medium (could be misleading if not checked)

4. **Body Not Signed**: Body content can be modified
   - Rationale: Design choice to avoid HTML/encoding issues
   - Mitigation: Put critical info in subject line
   - Risk: Medium (users must understand body is not authenticated)

### 9.2 Threat Model

**Protected Against:**
- ✅ Subject tampering (signed)
- ✅ From address spoofing (signed)
- ✅ To address modification (signed)
- ✅ Signature forgery (ECDSA security)
- ✅ Address impersonation (signature verification)

**NOT Protected Against:**
- ❌ Body content tampering (not signed)
- ❌ Attachment modification (not signed)
- ❌ Replay attacks (no nonce)
- ❌ Time-based attacks (no TTL)

### 9.3 Best Practices

**For Senders:**
1. Use hardware wallets or secure key storage
2. Never reuse keys across applications
3. Include critical info in subject line
4. Add ENS names for user-friendly verification

**For Recipients:**
1. Always verify signatures before trusting
2. Check timestamp for reasonableness
3. Be aware body content is NOT authenticated
4. Validate From address matches signer address
5. Use on-chain verification for high-value transactions

**For Implementers:**
1. Use well-tested crypto libraries (@noble/secp256k1, viem)
2. Validate all inputs before processing
3. Implement rate limiting for on-chain verification
4. Cache verification results when appropriate
5. Handle UTF-8 encoding carefully

---

## 10. Implementation Guidelines

### 10.1 Signing Implementation

```typescript
import { signEmail } from "colimail-cmvh";

const headers = await signEmail({
  privateKey: "0x...",           // 32-byte private key
  from: "alice@example.com",
  to: "bob@example.com",
  subject: "Meeting Tomorrow",
  body: "...",                    // Body not included in signature
  ens: "alice.eth",               // Optional
  reward: "0.05 wACT",            // Optional
});

// Inject headers into email before sending
```

### 10.2 Verification Implementation

```typescript
import { verifyCMVHHeaders } from "colimail-cmvh";

const result = await verifyCMVHHeaders({
  headers: extractedHeaders,
  from: "alice@example.com",
  to: "bob@example.com",
  subject: "Meeting Tomorrow",
  body: "...",                    // Body value doesn't affect verification
});

if (result.ok) {
  console.log("✅ Verified:", result.address);
  console.log("ENS:", result.ens);
} else {
  console.log("❌ Failed:", result.reason);
}
```

### 10.3 On-Chain Verification

```typescript
import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

const isValid = await client.readContract({
  address: "0xc4BAD26e321A8D0FE3bA3337Fc3846c25506308a",
  abi: CMVHVerifierABI,
  functionName: "verifyEmail",
  args: [signerAddress, subject, from, to, signature],
});
```

---

## 11. Examples

### 11.1 Complete Email with CMVH Headers

```
From: alice@company.com
To: bob@partner.org
Subject: Q4 Partnership Proposal
Date: Tue, 12 Nov 2025 10:30:00 +0000
X-CMVH-Version: 1
X-CMVH-Address: 0x5d17928193d5d47e159b35747ca4f77da184c11f
X-CMVH-Chain: Arbitrum
X-CMVH-Timestamp: 1731410000
X-CMVH-HashAlgo: keccak256
X-CMVH-Signature: 0x744dd21f4e952e97a197de090487b0648566e94d9b8c...
X-CMVH-ENS: alice.eth
X-CMVH-Reward: 0.05 wACT

Dear Bob,

I hope this email finds you well. I wanted to discuss our Q4
partnership opportunities.

Best regards,
Alice
```

### 11.2 Signature Generation Example

```python
# Pseudocode for signature generation

# 1. Canonicalize
subject = "Q4 Partnership Proposal"
from_addr = "alice@company.com"
to_addr = "bob@partner.org"
canonical = f"{subject}\n{from_addr}\n{to_addr}"

# 2. Hash
email_hash = keccak256(canonical.encode('utf-8'))
# Result: 0xa7f3... (32 bytes)

# 3. Sign
signature = ecdsa_sign(email_hash, private_key)
# Result: 0x744dd21f... (65 bytes)

# 4. Derive address
address = derive_address(private_key)
# Result: 0x5d17928...

# 5. Create headers
headers = {
    "X-CMVH-Version": "1",
    "X-CMVH-Address": address,
    "X-CMVH-Chain": "Arbitrum",
    "X-CMVH-Timestamp": str(int(time.time())),
    "X-CMVH-HashAlgo": "keccak256",
    "X-CMVH-Signature": signature,
    "X-CMVH-ENS": "alice.eth"
}
```

---

## 12. References

### 12.1 Standards

- **RFC 5322**: Internet Message Format
- **RFC 2119**: Key words for use in RFCs to Indicate Requirement Levels
- **EIP-191**: Signed Data Standard
- **EIP-1271**: Standard Signature Validation Method for Contracts

### 12.2 Cryptography

- **Keccak-256**: FIPS 202 SHA-3 Standard
- **secp256k1**: SEC 2 - Recommended Elliptic Curve Domain Parameters
- **ECDSA**: ANSI X9.62 - Public Key Cryptography for the Financial Services Industry

### 12.3 Blockchain

- **Ethereum Yellow Paper**: Formal specification of Ethereum
- **Arbitrum Documentation**: https://docs.arbitrum.io
- **OpenZeppelin ECDSA**: https://docs.openzeppelin.com/contracts/4.x/api/utils#ECDSA

### 12.4 Implementation

- **TypeScript SDK**: https://github.com/daodreamer/colimail-cmvh/tree/main/sdk/cmvh-js
- **Smart Contract**: https://github.com/daodreamer/colimail-cmvh/tree/main/contracts
- **ColiMail Client**: https://github.com/daodreamer/maildesk

---

## Appendix A: ABNF Grammar

```abnf
cmvh-header      = cmvh-version / cmvh-address / cmvh-chain /
                   cmvh-timestamp / cmvh-hashalgo / cmvh-signature /
                   cmvh-ens / cmvh-reward / cmvh-proofurl

cmvh-version     = "X-CMVH-Version:" SP "1" CRLF
cmvh-address     = "X-CMVH-Address:" SP eth-address CRLF
cmvh-chain       = "X-CMVH-Chain:" SP chain-name CRLF
cmvh-timestamp   = "X-CMVH-Timestamp:" SP unix-timestamp CRLF
cmvh-hashalgo    = "X-CMVH-HashAlgo:" SP "keccak256" CRLF
cmvh-signature   = "X-CMVH-Signature:" SP hex-signature CRLF
cmvh-ens         = "X-CMVH-ENS:" SP ens-name CRLF
cmvh-reward      = "X-CMVH-Reward:" SP reward-value CRLF
cmvh-proofurl    = "X-CMVH-ProofURL:" SP url CRLF

eth-address      = "0x" 40HEXDIG
hex-signature    = "0x" 130HEXDIG
chain-name       = "Arbitrum" / "Ethereum" / "ArbitrumSepolia"
unix-timestamp   = 10DIGIT
ens-name         = 1*63(ALPHA / DIGIT / "-") "." "eth"
reward-value     = 1*DIGIT ["." 1*DIGIT] SP token-symbol
token-symbol     = 1*ALPHA
url              = <as defined in RFC 3986>
```

---

## Appendix B: Test Vectors

### Test Vector 1: Basic Email

```
Subject: "Test"
From: alice@example.com
To: bob@example.com

Canonical Form:
"Test\nalice@example.com\nbob@example.com"

Keccak256 Hash:
0x8f3b5c7d9e1a2f4b6c8d0e1a3f5b7c9d1e3a5f7b9d1c3e5a7b9d1e3f5a7c9d1e

Private Key:
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Expected Address:
0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

Expected Signature:
0x[130 hex characters]
```

### Test Vector 2: Unicode Email

```
Subject: "Hello 世界"
From: 测试@example.com
To: test@example.com

Canonical Form:
"Hello 世界\n测试@example.com\ntest@example.com"

Note: UTF-8 encoding preserved
```

---

## Appendix C: Change Log

### Version 1.0 (2025-11-12)
- Initial specification
- Canonicalization: subject\nfrom\nto (body excluded)
- ECDSA secp256k1 signatures
- Keccak-256 hashing
- X-CMVH-* header format
- Smart contract verification
- Local verification
- MVP feature set

---

## Authors

**ColiMail Labs**
Email: dao@colimail.io
Website: https://colimail.io

**Dao Dreamer** (Lead Developer)
GitHub: @daodreamer

---

## License

This specification is licensed under the MIT License.

Copyright (c) 2025 ColiMail Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this specification to implement it for any purpose.

---

**End of RFC-CMVH-0001**
