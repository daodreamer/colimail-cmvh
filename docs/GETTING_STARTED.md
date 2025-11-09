# Getting Started with colimail-cmvh

Quick guide to install and use the CMVH SDK.

## Prerequisites

- Node.js >= 18.0.0
- npm, yarn, or pnpm

## Installation

```powershell
cd sdk\cmvh-js
npm install
```

## Build the Library

```powershell
npm run build
```

This generates ESM and CJS outputs in `./dist/`.

## Run Tests

```powershell
npm test
```

For watch mode:

```powershell
npm run test:watch
```

## Run Example

```powershell
npm run build
node examples/basic-usage.ts
```

Expected output:
```
🔐 CMVH Email Signing Example

📝 Signing email...

✅ Generated CMVH Headers:
{
  "X-CMVH-Version": "1",
  "X-CMVH-Address": "0x...",
  ...
}

🔍 Verifying signature...

✅ Verification SUCCESSFUL!
   Address: 0x...
   ENS: alice.eth
   Timestamp: 2025-11-09T...
```

## Publish to NPM (Maintainers Only)

1. Login to NPM:
   ```powershell
   npm login
   ```

2. Publish:
   ```powershell
   npm publish --access public
   ```

## Development Workflow

1. Make changes to `src/`
2. Run tests: `npm test`
3. Build: `npm run build`
4. Test in example: `node examples/basic-usage.ts`

## Type Checking

```powershell
npm run typecheck
```

## Linting

```powershell
npm run lint
```

## Project Structure

```
sdk/cmvh-js/
├── src/
│   ├── index.ts          # Main exports
│   ├── types.ts          # Type definitions
│   ├── sign.ts           # Signing logic
│   ├── verify.ts         # Verification logic
│   ├── canonicalize.ts   # Email canonicalization
│   ├── headers.ts        # Header parsing/formatting
│   ├── crypto.ts         # Cryptographic utilities
│   └── errors.ts         # Error classes
├── tests/
│   ├── sign-verify.test.ts
│   └── headers.test.ts
├── examples/
│   └── basic-usage.ts
├── dist/                 # Build output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Next Steps

- Read [MVP_SPEC.md](../../docs/MVP_SPEC.md) for detailed specification
- Check [README.md](./README.md) for API documentation
- Explore examples in `examples/`
- Review tests in `tests/`

## Troubleshooting

### Dependencies not installing

Make sure Node.js >= 18:
```powershell
node --version
```

### Build fails

Clean and rebuild:
```powershell
Remove-Item -Recurse -Force dist, node_modules
npm install
npm run build
```

### Tests fail

Check that you're in the correct directory:
```powershell
cd sdk\cmvh-js
npm test
```
