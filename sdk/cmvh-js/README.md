# colimail-cmvh

**ColiMail Verification Header (CMVH)** - Blockchain-based email authentication SDK

[![npm version](https://img.shields.io/npm/v/colimail-cmvh.svg)](https://www.npmjs.com/package/colimail-cmvh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Bring blockchain trust to email communication with cryptographic signatures and on-chain verification.

## 🚀 Features

- ✅ **Sign emails** with Ethereum private keys (secp256k1)
- ✅ **Verify signatures** locally without blockchain calls (MVP)
- ✅ **Canonical hashing** for tamper-proof email content
- ✅ **ENS support** (optional display name)
- ✅ **Lightweight** - minimal dependencies (@noble/secp256k1, @noble/hashes)
- 🔮 **Future**: On-chain verification (EIP-1271), reward claiming, IPFS proofs

## 📦 Installation

```bash
npm install colimail-cmvh
```

Or with your preferred package manager:

```bash
yarn add colimail-cmvh
pnpm add colimail-cmvh
```

## 🎯 Quick Start

### Sign an Email

```typescript
import { signEmail } from "colimail-cmvh";

const headers = await signEmail({
  privateKey: "0xabcd1234...", // Your Ethereum private key
  from: "alice@gmail.com",
  to: "bob@outlook.com",
  subject: "Partnership Proposal",
  body: "Hello Bob, let's collaborate on the new project...",
  ens: "alice.eth", // Optional
});

console.log(headers);
// {
//   "X-CMVH-Version": "1",
//   "X-CMVH-Address": "0x53dA9B...",
//   "X-CMVH-Chain": "Arbitrum",
//   "X-CMVH-Timestamp": "1730733600",
//   "X-CMVH-HashAlgo": "keccak256",
//   "X-CMVH-Signature": "0xd54f3b...",
//   "X-CMVH-ENS": "alice.eth"
// }
```

### Verify an Email

```typescript
import { verifyCMVHHeaders } from "colimail-cmvh";

const result = await verifyCMVHHeaders({
  headers: emailHeaders, // Raw headers object or parsed CMVH headers
  from: "alice@gmail.com",
  to: "bob@outlook.com",
  subject: "Partnership Proposal",
  body: "Hello Bob, let's collaborate on the new project...",
});

if (result.ok) {
  console.log("✅ Verified from:", result.address);
  console.log("📛 ENS:", result.ens);
} else {
  console.log("❌ Verification failed:", result.reason);
}
```

### Parse Headers from Raw Email

```typescript
import { parseRawHeaders, formatCMVHHeaders } from "colimail-cmvh";

const rawEmail = `
From: alice@gmail.com
To: bob@outlook.com
Subject: Test
X-CMVH-Version: 1
X-CMVH-Address: 0x53dA9B...
X-CMVH-Signature: 0xd54f3b...
`;

const parsed = parseRawHeaders(rawEmail);
console.log(parsed.address); // "0x53dA9B..."

// Format back to header lines
const formatted = formatCMVHHeaders(parsed);
console.log(formatted);
// X-CMVH-Version: 1
// X-CMVH-Address: 0x53dA9B...
// ...
```

## 📚 API Reference

### Core Functions

#### `signEmail(input: SignEmailInput): Promise<CMVHHeaders>`

Sign an email and generate CMVH headers.

**Parameters:**
- `privateKey` (HexString) - Ethereum private key with 0x prefix
- `from` (string) - Sender email address
- `to` (string) - Recipient email address
- `subject` (string) - Email subject
- `body` (string) - Email body (plain text)
- `timestamp` (number, optional) - Unix timestamp (defaults to now)
- `chain` (ChainName, optional) - Blockchain name (defaults to "Arbitrum")
- `ens` (string, optional) - ENS name
- `reward` (string, optional) - Reward amount (e.g., "0.05 wACT")
- `proofURL` (string, optional) - IPFS or on-chain proof URL

**Returns:** `CMVHHeaders` object

---

#### `verifyCMVHHeaders(params): Promise<VerificationResult>`

Verify CMVH signature against email content.

**Parameters:**
- `headers` (string | RawHeaders | ParsedCMVHHeaders) - Email headers
- `from` (string) - Sender email
- `to` (string) - Recipient email
- `subject` (string) - Email subject
- `body` (string) - Email body

**Returns:** `VerificationResult`
```typescript
{
  ok: boolean;
  address?: Address;      // Recovered signer address
  ens?: string;           // ENS name if provided
  timestamp?: number;     // Signature timestamp
  reason?: string;        // Error reason if ok=false
}
```

---

#### `canonicalizeEmail(content: EmailContent): string`

Generate canonical string representation of email for hashing.

**Format:** `SUBJECT\nFROM\nTO\nBODY`

---

#### `parseRawHeaders(raw: string | RawHeaders): ParsedCMVHHeaders`

Extract CMVH fields from raw email headers.

---

#### `formatCMVHHeaders(headers: ParsedCMVHHeaders): string`

Format CMVH headers as multiline string for email injection.

---

### Utility Functions

#### `keccak256(data: string | Uint8Array): HexString`

Hash data using Keccak-256 (Ethereum standard).

#### `recoverAddress(hash: HexString, signature: HexString): Promise<Address>`

Recover Ethereum address from signature and hash.

#### `isValidAddress(address: string): boolean`

Check if string is a valid Ethereum address (0x + 40 hex chars).

#### `isValidHex(hex: string): boolean`

Check if string is valid hex format.

---

### Types

```typescript
type HexString = `0x${string}`;
type Address = HexString;
type HashAlgorithm = "keccak256";
type ChainName = "Arbitrum" | "Ethereum" | "ArbitrumSepolia";

interface CMVHHeaders {
  "X-CMVH-Version": string;
  "X-CMVH-Address": Address;
  "X-CMVH-Chain": ChainName;
  "X-CMVH-Timestamp": string;
  "X-CMVH-HashAlgo": HashAlgorithm;
  "X-CMVH-Signature": HexString;
  "X-CMVH-ENS"?: string;
  "X-CMVH-Reward"?: string;
  "X-CMVH-ProofURL"?: string;
}
```

See full type definitions in [`src/types.ts`](./src/types.ts).

---

## 🔒 Security Notes (MVP)

**Current Limitations:**
- ✅ Local signature verification only (no smart contract calls)
- ⚠️ **No replay attack protection** - same email can be signed multiple times
- ⚠️ **No timestamp validation** - expired signatures not rejected
- ⚠️ **No forwarding detection** - email can be forwarded with original signature
- ⚠️ **UTF-8 only** - non-UTF-8 bodies may fail canonicalization

**Best Practices:**
- Never reuse private keys across applications
- Store private keys securely (hardware wallets, encrypted storage)
- Validate email content before signing
- Treat unsigned/unverified emails with caution

**Future Security Enhancements:**
- On-chain signature registry (EIP-1271 support)
- Nonce-based replay protection
- Time-bound validity windows
- Multi-signature support

---

## 🧪 Testing

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

---

## 🏗️ Build

```bash
npm run build
```

Outputs ESM and CJS builds to `./dist/`.

---

## 📖 Specification

CMVH follows the open standard defined in [RFC-CMVH-0001](../../docs/RFC-CMVH-0001.md).

**Spec Version:** 1.0.0  
**Library Version:** 1.0.0

---

## 🛣️ Roadmap

- [x] MVP: Local signature & verification
- [ ] EIP-1271 smart contract verification
- [ ] ENS reverse resolution
- [ ] On-chain hash storage
- [ ] Reward pool integration (wACT tokens)
- [ ] IPFS attachment verification
- [ ] Email encryption layer (CMVH-Encrypt)

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Development Setup

```bash
# Clone repo
git clone https://github.com/daodreamer/colimail-cmvh.git
cd colimail-cmvh/sdk/cmvh-js

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

---

## 📄 License

MIT © ColiMail Labs (Dao Dreamer)

---

## 🔗 Links

- [GitHub Repository](https://github.com/daodreamer/colimail-cmvh)
- [NPM Package](https://www.npmjs.com/package/colimail-cmvh)
- [Documentation](../../docs/)
- [ColiMail Project](https://colimail.io) _(Coming Soon)_

---

**Made with ❤️ for decentralized email authentication**
