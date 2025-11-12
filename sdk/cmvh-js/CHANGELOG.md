# Changelog

All notable changes to the CMVH SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-12

### ⚠️ Breaking Changes

- **CRITICAL**: Changed canonicalization algorithm to exclude email body
  - **Old**: `canonical = subject\nfrom\nto\nbody`
  - **New**: `canonical = subject\nfrom\nto`
  - **Reason**: Body excluded to avoid HTML formatting, whitespace, and encoding inconsistencies
  - **Impact**: Signatures generated with v1.0.0 are incompatible with v1.1.0+

### Changed

- Updated `canonicalizeEmail()` to only hash metadata (subject, from, to)
- Body parameter still required in `EmailContent` type for compatibility, but not used in signature
- Updated all tests to reflect new canonicalization behavior (47/47 tests passing)

### Added

- Comprehensive documentation explaining why body is excluded
- Test cases for body-excluded behavior
- Examples showing body changes don't affect verification

### Fixed

- Aligned SDK implementation with production ColiMail client (Rust/Tauri)
- Fixed inconsistency between SDK and smart contract canonicalization

### Documentation

- Created RFC-CMVH-0001 (official specification)
- Updated MVP_SPEC.md with actual implementation details
- Updated CMVH_DEV.md with Phase 1-3 completion status
- All documentation now reflects body-excluded canonicalization

### Performance

- Canonicalization faster (less data to process)
- Signing: ~2.5ms (small emails), ~2.3ms (large emails)
- Verification: ~1.3ms average
- Memory: ~4.4MB for 1000 emails

## [1.0.0] - 2025-11-10

### Added

- Initial release of CMVH SDK
- Email signing with Ethereum private keys (secp256k1)
- Local signature verification (no blockchain required)
- Canonical email hashing (keccak256)
- CMVH header parsing and formatting
- ENS name support (display only)
- Reward field support (metadata only)
- TypeScript type definitions
- Comprehensive test suite (47 tests)
- Performance benchmarks
- ESM and CJS dual format output

### Features

- ✅ Sign emails with `signEmail()`
- ✅ Verify signatures with `verifyCMVHHeaders()`
- ✅ Parse headers with `parseRawHeaders()`
- ✅ Format headers with `formatCMVHHeaders()`
- ✅ Canonicalize with `canonicalizeEmail()`

### Security

- Uses battle-tested crypto libraries (@noble/secp256k1, @noble/hashes)
- No custom cryptography implementation
- Input validation for all public APIs

### Known Limitations

- No replay protection (by design for MVP)
- No timestamp validation (by design for MVP)
- No on-chain verification (Phase 2 feature)
- Body included in v1.0.0 (changed in v1.1.0)

---

## Migration Guide: v1.0.0 → v1.1.0

### For Users

**Impact**: Signatures generated with v1.0.0 will NOT verify with v1.1.0

**Action Required**:
1. Upgrade to v1.1.0
2. Re-sign any emails that need verification
3. Update all clients to v1.1.0+ to ensure compatibility

### For Developers

**No Code Changes Required** for basic usage:
```typescript
// This code works with both versions
const headers = await signEmail({
  privateKey: "0x...",
  from: "alice@example.com",
  to: "bob@example.com",
  subject: "Test",
  body: "Content"  // Still required, but not signed in v1.1.0
});
```

**Behavior Changes**:
```typescript
// v1.0.0: Changing body would break verification
// v1.1.0: Changing body does NOT affect verification

const result = await verifyCMVHHeaders({
  headers,
  from: "alice@example.com",
  to: "bob@example.com",
  subject: "Test",
  body: "Different content"  // ✅ Still verifies in v1.1.0
});
```

**Test Changes**:
- Tests expecting body tampering to fail verification must be updated
- Canonicalization tests must check body is excluded

### Rationale

This breaking change aligns the SDK with:
1. **Production Implementation**: ColiMail client (Rust/Tauri) uses body-excluded canonicalization
2. **Smart Contract**: CMVHVerifier.sol on Arbitrum Sepolia uses metadata-only hashing
3. **Spec**: RFC-CMVH-0001 official specification
4. **Best Practices**: Avoids HTML/encoding/whitespace issues

---

## Versioning Policy

- **Major version** (x.0.0): Breaking changes to public API or signature format
- **Minor version** (1.x.0): New features, backward compatible
- **Patch version** (1.1.x): Bug fixes, backward compatible

---

## Links

- [GitHub Repository](https://github.com/daodreamer/colimail-cmvh)
- [NPM Package](https://www.npmjs.com/package/colimail-cmvh)
- [Documentation](../../docs/)
- [RFC-CMVH-0001](../../docs/RFC-CMVH-0001.md)
- [Smart Contract](../../contracts/)
