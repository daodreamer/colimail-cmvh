# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ColiMail Verification Header (CMVH)** is an open standard and SDK for blockchain-based email authentication. It allows emails to be signed with Ethereum private keys and verified using cryptographic signatures, bringing web3 identity verification to traditional email (IMAP/SMTP) without requiring server-side modifications.

- **SDK**: TypeScript/JavaScript library (`colimail-cmvh` package)
- **Crypto**: secp256k1 signatures with keccak256 hashing
- **Verification**: Local signature verification (MVP) with future blockchain integration
- **Headers**: Custom X-CMVH-* email headers for authentication metadata

## Development Commands

### SDK Development (cmvh-js)
All commands should be run from `sdk/cmvh-js/` directory:

```bash
npm install                    # Install dependencies
npm run build                  # Build ESM and CJS outputs to dist/
npm test                       # Run Vitest unit tests
npm run test:watch             # Run tests in watch mode
npm run typecheck              # Run TypeScript type checking
npm run lint                   # Run ESLint
npm run prepublishOnly         # Build and test before publishing
```

### Running Static Checks
After any code changes, **always run** the appropriate checks before reporting completion:
- TypeScript changes: `npm run typecheck && npm run lint` from `sdk/cmvh-js/`
- Before committing: `npm test && npm run build` from `sdk/cmvh-js/`

**IMPORTANT**: All tests must pass and build must succeed before marking a task as complete.

## Architecture

**Most Important Documentation Files**:
- `CMVH_DEV.md`: Complete project vision and roadmap
- `docs/MVP_SPEC.md`: Technical specification for MVP
- `docs/GETTING_STARTED.md`: Setup and development guide

### SDK Structure (`sdk/cmvh-js/`)

**Entry Point**: `src/index.ts`
- Exports main functions: `signEmail`, `verifyEmail`, `parseHeaders`, `formatHeaders`
- Re-exports types and error classes

**Core Modules**:

1. **`src/types.ts`**: TypeScript type definitions
   - `CMVHHeaders`: Required and optional header fields
   - `EmailContent`: Input structure for signing
   - `VerificationResult`: Output from verification
   - Utility types: `Address`, `HexString`, `ChainName`

2. **`src/sign.ts`**: Email signing logic
   - `signEmail()`: Main signing function
   - Generates CMVH headers with signature
   - Returns headers object or formatted string

3. **`src/verify.ts`**: Signature verification
   - `verifyEmail()`: Main verification function
   - Recovers signer address from signature
   - Validates required headers and content integrity

4. **`src/canonicalize.ts`**: Email canonicalization
   - `canonicalizeEmail()`: Deterministic string generation
   - Order: `subject\nfrom\nto\nbody`
   - No trimming or normalization (UTF-8 assumed)

5. **`src/crypto.ts`**: Cryptographic utilities
   - `hashEmail()`: keccak256 hashing
   - `signHash()`: secp256k1 ECDSA signing
   - `recoverAddress()`: Address recovery from signature

6. **`src/headers.ts`**: Header parsing and formatting
   - `parseHeaders()`: Parse X-CMVH-* headers from string or object
   - `formatHeaders()`: Format headers for email clients
   - `validateHeaders()`: Validate required fields

7. **`src/errors.ts`**: Custom error classes
   - `CMVHError`: Base error class
   - `SigningError`, `VerificationError`, `ValidationError`

### CMVH Header Specification

Required headers (must be present in every signed email):
```
X-CMVH-Version: 1
X-CMVH-Address: 0x... (Ethereum address)
X-CMVH-Chain: Arbitrum | Ethereum | ArbitrumSepolia
X-CMVH-Timestamp: <unix timestamp in seconds>
X-CMVH-HashAlgo: keccak256
X-CMVH-Signature: 0x... (65 bytes, 130 hex chars)
```

Optional headers:
```
X-CMVH-ENS: <ens name> (display only in MVP)
X-CMVH-Reward: <amount token> (e.g., "0.05 wACT")
X-CMVH-ProofURL: <ipfs or on-chain URL>
```

### Cryptographic Algorithms

1. **Canonicalization**:
   - Concatenate fields: `subject\nfrom\nto\nbody`
   - Preserve exact content (no whitespace normalization)
   - UTF-8 encoding assumed

2. **Hashing**:
   - Algorithm: keccak256 (Ethereum standard)
   - Input: UTF-8 bytes of canonical string
   - Output: 32-byte hash with `0x` prefix

3. **Signing**:
   - Curve: secp256k1
   - Method: ECDSA over hash
   - Format: 65 bytes (r + s + v) with `0x` prefix

4. **Verification**:
   - Recover address from signature and hash
   - Compare with claimed address (case-insensitive)
   - Return boolean validity + metadata

## Language and Code Style Conventions

1. **All code and comments must be in English**
2. **Assistant responses should be in Chinese** (for consistency with project documentation)
3. Use latest stable versions of dependencies
4. Always run tests and type checks after modifications
5. Follow TypeScript best practices and ESLint rules

## Development Principles

1. **Security First**:
   - Cryptographic operations must use well-tested libraries (`@noble/secp256k1`, `viem`)
   - Never implement custom crypto algorithms
   - Validate all inputs before processing

2. **Type Safety**:
   - Use strict TypeScript types for all functions
   - Avoid `any` type unless absolutely necessary
   - Define clear interfaces for public APIs

3. **Error Handling**:
   - Use custom error classes (`SigningError`, `VerificationError`)
   - Provide clear error messages with actionable information
   - Never swallow errors silently

4. **Testing**:
   - Write unit tests for all core functions
   - Test edge cases and error conditions
   - Maintain high test coverage

## NPM Dependencies (Key)

- `viem` v2.38: Ethereum utilities and type definitions
- `@noble/secp256k1` v3.0: secp256k1 elliptic curve operations
- `@noble/hashes` v2.0: keccak256 and other hash functions
- `vitest` v4.0: Testing framework
- `tsup` v8.5: TypeScript bundler for ESM/CJS outputs
- `typescript` v5.9: TypeScript compiler
- `eslint` v9.39: Linting and code quality

## MVP Features and Limitations

### Currently Implemented (MVP)
✅ Local signature generation with Ethereum private keys
✅ Local signature verification (address recovery)
✅ Deterministic email canonicalization
✅ keccak256 hashing
✅ secp256k1 ECDSA signing
✅ Header parsing and formatting
✅ TypeScript type definitions
✅ Comprehensive unit tests

### Known Limitations (MVP)
❌ **No replay protection**: Same email can be signed multiple times
❌ **No timestamp validation**: Expired/future signatures accepted
❌ **No on-chain verification**: Local only (no EIP-1271)
❌ **No ENS resolution**: ENS field is display-only
❌ **No reward claiming**: Reward field is metadata only
❌ **UTF-8 only**: Non-UTF-8 content may fail
❌ **No forwarding detection**: Original signature persists on forwards

### Future Roadmap
- **Phase 2**: Smart contract deployment (CMVHVerifier.sol on Arbitrum)
- **Phase 3**: EIP-1271 contract signature verification
- **Phase 4**: Reward pool and wACT token integration
- **Phase 5**: Browser extension for Gmail/Outlook

## Project Structure

```
colimail-cmvh/
├── sdk/
│   └── cmvh-js/              # Main SDK package
│       ├── src/
│       │   ├── index.ts      # Main exports
│       │   ├── types.ts      # Type definitions
│       │   ├── sign.ts       # Signing logic
│       │   ├── verify.ts     # Verification logic
│       │   ├── canonicalize.ts # Email canonicalization
│       │   ├── crypto.ts     # Cryptographic utilities
│       │   ├── headers.ts    # Header parsing/formatting
│       │   └── errors.ts     # Error classes
│       ├── tests/            # Vitest unit tests
│       ├── examples/         # Usage examples
│       ├── dist/             # Build output (generated)
│       └── package.json
├── docs/
│   ├── MVP_SPEC.md          # Technical specification
│   └── GETTING_STARTED.md   # Setup guide
├── CMVH_DEV.md              # Complete project documentation
├── CLAUDE.md                # This file
└── LICENSE                  # MIT License
```

## Common Development Tasks

### Adding a New Feature to SDK

1. Read `docs/MVP_SPEC.md` to understand current scope
2. Add types to `src/types.ts` if needed
3. Implement core logic in appropriate module (`sign.ts`, `verify.ts`, etc.)
4. Export from `src/index.ts`
5. Write unit tests in `tests/`
6. Run `npm test && npm run build`
7. Update documentation if public API changes

### Modifying Cryptographic Logic

⚠️ **CRITICAL**: Cryptographic changes require extreme care
1. Consult `docs/MVP_SPEC.md` for algorithm specifications
2. Never implement custom crypto - use `@noble/*` or `viem`
3. Write comprehensive tests for edge cases
4. Verify compatibility with existing signatures
5. Document any breaking changes

### Debugging Signature Verification Issues

Common causes:
1. **Content mismatch**: Canonicalization order must be exact (`subject\nfrom\nto\nbody`)
2. **Encoding issues**: Content must be UTF-8
3. **Header parsing**: Check for whitespace or newline issues
4. **Address format**: Addresses must be checksummed and lowercase compared
5. **Signature format**: Must be 65 bytes (130 hex chars) with `0x` prefix

## Execution Rules for Claude Code

These rules **must be followed** during every execution session:

1. **Security Critical Code**: This project handles cryptographic operations. Always prioritize security and correctness over convenience. Validate all inputs and use established libraries.

2. **Test Before Completing**: After any code changes, MUST run `npm test && npm run typecheck` from `sdk/cmvh-js/`. Never mark tasks as complete if tests fail.

3. **Clean Up Temporary Files**: Delete any temporary files, scripts, or helper files created during development.

4. **Never Speculate About Unread Code**: Always read files before making assertions. Provide well-reasoned, hallucination-free responses based on actual code inspection.

5. **Maintain Backward Compatibility**: The SDK is meant to be published to NPM. Breaking changes require version bumps and clear documentation.