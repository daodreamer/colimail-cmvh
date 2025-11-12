# CMVH MVP Specification

**Version:** 1.0.0
**Status:** ✅ **Production Ready** (Phase 1-3 Complete)
**Date:** 2025-11-12
**Last Updated:** 2025-11-12

---

## Scope

This document defines the **implemented** specification for ColiMail Verification Header (CMVH) v1.0. The specification has been fully implemented and tested across:
- **Phase 1**: TypeScript SDK (47 tests passing)
- **Phase 2**: Solidity smart contract (27 tests passing, deployed to Arbitrum Sepolia)
- **Phase 3**: Rust/Tauri client integration (production ready)

## Features Implemented

✅ **Local Signing** - Sign emails with Ethereum private keys (Rust + TypeScript)
✅ **Local Verification** - Verify signatures without blockchain calls (<50ms)
✅ **On-Chain Verification** - Smart contract verification on Arbitrum Sepolia (~28k gas)
✅ **Canonical Hashing** - Deterministic email metadata hashing (subject, from, to)
✅ **ENS Display** - Optional ENS name field (display-only, no resolution)
✅ **Reward Field** - Optional reward amount field (metadata only, no claiming)
✅ **Smart Contract** - CMVHVerifier deployed at `0xc4BAD26e321A8D0FE3bA3337Fc3846c25506308a`
✅ **Client Integration** - Full Tauri/SvelteKit implementation with UI

## Features for Future Phases

❌ ENS reverse resolution (Phase 4+)
❌ Reward claiming mechanism (Phase 4+)
❌ Replay attack protection with nonce (Phase 4+)
❌ Timestamp TTL validation (Phase 4+)
❌ IPFS attachment proofs (Phase 4+)
❌ EIP-1271 contract signatures (Phase 4+)

---

## Required CMVH Header Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `X-CMVH-Version` | string | ✅ | Protocol version (must be "1") |
| `X-CMVH-Address` | Address | ✅ | Signer's Ethereum address (0x + 40 hex) |
| `X-CMVH-Chain` | ChainName | ✅ | Blockchain name (e.g., "Arbitrum") |
| `X-CMVH-Timestamp` | string | ✅ | Unix timestamp (seconds) |
| `X-CMVH-HashAlgo` | string | ✅ | Hash algorithm (must be "keccak256") |
| `X-CMVH-Signature` | HexString | ✅ | secp256k1 signature (0x + 130 hex) |

## Optional CMVH Header Fields

| Field | Type | Description |
|-------|------|-------------|
| `X-CMVH-ENS` | string | ENS name (display only) |
| `X-CMVH-Reward` | string | Reward amount (e.g., "0.05 wACT") |
| `X-CMVH-ProofURL` | string | IPFS or on-chain proof URL |

---

## Canonicalization Algorithm

**Input:** Email metadata (from, to, subject) - **BODY EXCLUDED**
**Output:** Canonical string for hashing

### Algorithm (CMVH v1.0)

```
canonical = SUBJECT + "\n" + FROM + "\n" + TO
```

**⚠️ IMPORTANT CHANGE**: Body is **intentionally excluded** to avoid HTML formatting, whitespace, and encoding inconsistencies.

### Rules

1. Fields are concatenated with single newline (`\n`) separators
2. Order is strictly: `subject`, `from`, `to` (**body excluded**)
3. No trimming or whitespace normalization
4. No encoding transformation (UTF-8 assumed)
5. Empty fields are allowed (empty string)
6. **Body content is NOT signed** - only metadata is authenticated

### Design Rationale

**Why exclude body?**
- HTML formatting differences across email clients
- Whitespace normalization inconsistencies
- Encoding variations (UTF-8, quoted-printable, base64)
- MIME multipart complexity
- Attachment handling complexity

**Metadata (subject, from, to) is sufficient for authentication** and remains consistent across clients.

### Example

```typescript
Input:
{
  subject: "Test Email",
  from: "alice@example.com",
  to: "bob@example.com",
  body: "Hello world"  // Body is NOT included in canonical form
}

Canonical (CMVH v1.0):
"Test Email\nalice@example.com\nbob@example.com"
// Note: Body "Hello world" is excluded from canonicalization
```

---

## Hashing Algorithm

**Algorithm:** keccak256 (Ethereum standard)  
**Input:** Canonical string as UTF-8 bytes  
**Output:** 32-byte hash with `0x` prefix

### Implementation

```typescript
hash = keccak256(utf8Encode(canonicalString))
```

---

## Signature Algorithm

**Curve:** secp256k1 (Ethereum standard)  
**Method:** ECDSA signature over hash  
**Format:** 65 bytes (r + s + v) with `0x` prefix

### Signing

```typescript
signature = sign(hash, privateKey)
// Returns: 0x + 130 hex characters (65 bytes)
```

### Verification

```typescript
recoveredAddress = recoverAddress(hash, signature)
isValid = recoveredAddress.toLowerCase() === claimedAddress.toLowerCase()
```

---

## Security Constraints (MVP)

### Known Limitations

1. **No Replay Protection**  
   - Same email can be signed multiple times  
   - No nonce or unique identifier

2. **No Timestamp Validation**  
   - Expired signatures are accepted  
   - Future timestamps are accepted

3. **No Forwarding Detection**  
   - Email can be forwarded with original signature intact  
   - No sender verification beyond signature

4. **UTF-8 Only**  
   - Non-UTF-8 content may cause canonicalization failure  
   - No charset normalization

5. **Local Verification Only**  
   - No smart contract verification  
   - No EIP-1271 support for contract wallets

### Acceptable Use Cases

- Proof of authorship for newsletters
- Identity verification for support tickets
- Low-stakes communication authentication
- Development and testing

### Not Suitable For

- Financial transactions
- Legal contracts
- High-security communications
- Multi-signature workflows

---

## Error Handling

### Signing Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Missing private key | `privateKey` not provided | Provide valid hex private key |
| Invalid private key | Wrong format | Use `0x` prefix + 64 hex chars |
| Missing required field | `from`, `to`, `subject`, or `body` missing | Provide all fields |

### Verification Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Missing headers | Required CMVH headers not found | Check header parsing |
| Invalid version | Version ≠ "1" | Unsupported protocol version |
| Unsupported hash algo | HashAlgo ≠ "keccak256" | Unsupported algorithm |
| Signature mismatch | Content tampered or wrong signer | Email content modified |

---

## TypeScript Types

```typescript
type HexString = `0x${string}`;
type Address = HexString;
type ChainName = "Arbitrum" | "Ethereum" | "ArbitrumSepolia";

interface CMVHHeaders {
  "X-CMVH-Version": string;
  "X-CMVH-Address": Address;
  "X-CMVH-Chain": ChainName;
  "X-CMVH-Timestamp": string;
  "X-CMVH-HashAlgo": "keccak256";
  "X-CMVH-Signature": HexString;
  "X-CMVH-ENS"?: string;
  "X-CMVH-Reward"?: string;
  "X-CMVH-ProofURL"?: string;
}

interface VerificationResult {
  ok: boolean;
  address?: Address;
  ens?: string;
  timestamp?: number;
  reason?: string;
}
```

---

## Implementation Checklist

- [x] Canonical string generation
- [x] keccak256 hashing
- [x] secp256k1 signing
- [x] Signature verification (address recovery)
- [x] Header parsing (multiline string & object)
- [x] Header formatting (to email format)
- [x] Header validation (required fields)
- [x] TypeScript type definitions
- [x] Error classes
- [x] Unit tests (sign, verify, parse)
- [x] Integration tests (full email flow) - **19 comprehensive tests**
- [x] Performance benchmarks - **11 benchmark suites with auto-generated report**

---

## Future Enhancements (Post-MVP)

- **v1.1**: EIP-1271 contract signature verification
- **v1.2**: ENS reverse resolution
- **v1.3**: Replay protection (nonce-based)
- **v1.4**: Timestamp validation (TTL)
- **v2.0**: On-chain hash storage
- **v2.1**: Reward claiming system
- **v2.2**: IPFS attachment verification

---

## References

- [CMVH_DEV.md](../../CMVH_DEV.md) - Full project documentation
- [secp256k1](https://en.bitcoin.it/wiki/Secp256k1) - Elliptic curve
- [keccak256](https://en.wikipedia.org/wiki/SHA-3) - Hash function
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) - Signed data standard
- [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) - Contract signatures (future)

---

**Document Status:** Ready for Implementation  
**Next Review:** After MVP release
