# CMVH Performance Benchmark Report

Generated: 2025-11-17T16:55:08.134Z
Node.js: v24.4.1
Platform: win32 x64

---

## Summary

| Operation | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |
|-----------|---------------|---------------|---------------|---------|
| Email Signing (small) | 2.595 | 2.135 | 3.765 | 385.41 |
| Email Signing (medium) | 2.400 | 2.112 | 3.217 | 416.69 |
| Email Signing (large) | 2.406 | 2.118 | 3.143 | 415.68 |
| Email Verification (small) | 1.374 | 1.206 | 2.321 | 727.54 |
| Email Verification (medium) | 1.367 | 1.213 | 2.442 | 731.30 |
| Email Verification (large) | 1.351 | 1.188 | 2.226 | 740.23 |
| Bulk Signing (100 emails) | 201.126 | 195.963 | 206.082 | 4.97 |
| Bulk Verification (100 emails) | 114.891 | 113.711 | 116.842 | 8.70 |
| Memory Usage (1000 emails) | 0.000 | 0.000 | 0.000 | 0.00 |

---

## Detailed Results

### Email Signing (small)

- **Iterations**: 100
- **Total Time**: 259.46 ms
- **Average Time**: 2.595 ms
- **Min Time**: 2.135 ms
- **Max Time**: 3.765 ms
- **Operations per Second**: 385.41

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Signing (medium)

- **Iterations**: 50
- **Total Time**: 119.99 ms
- **Average Time**: 2.400 ms
- **Min Time**: 2.112 ms
- **Max Time**: 3.217 ms
- **Operations per Second**: 416.69

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Signing (large)

- **Iterations**: 20
- **Total Time**: 48.11 ms
- **Average Time**: 2.406 ms
- **Min Time**: 2.118 ms
- **Max Time**: 3.143 ms
- **Operations per Second**: 415.68

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Verification (small)

- **Iterations**: 100
- **Total Time**: 137.45 ms
- **Average Time**: 1.374 ms
- **Min Time**: 1.206 ms
- **Max Time**: 2.321 ms
- **Operations per Second**: 727.54

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Verification (medium)

- **Iterations**: 50
- **Total Time**: 68.37 ms
- **Average Time**: 1.367 ms
- **Min Time**: 1.213 ms
- **Max Time**: 2.442 ms
- **Operations per Second**: 731.30

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Verification (large)

- **Iterations**: 20
- **Total Time**: 27.02 ms
- **Average Time**: 1.351 ms
- **Min Time**: 1.188 ms
- **Max Time**: 2.226 ms
- **Operations per Second**: 740.23

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Bulk Signing (100 emails)

- **Iterations**: 5
- **Total Time**: 1005.63 ms
- **Average Time**: 201.126 ms
- **Min Time**: 195.963 ms
- **Max Time**: 206.082 ms
- **Operations per Second**: 4.97

**Details:**
- emailCount: 100
- parallelExecution: true

### Bulk Verification (100 emails)

- **Iterations**: 5
- **Total Time**: 574.45 ms
- **Average Time**: 114.891 ms
- **Min Time**: 113.711 ms
- **Max Time**: 116.842 ms
- **Operations per Second**: 8.70

**Details:**
- emailCount: 100
- parallelExecution: true

### Memory Usage (1000 emails)

- **Iterations**: 1000
- **Total Time**: 0.00 ms
- **Average Time**: 0.000 ms
- **Min Time**: 0.000 ms
- **Max Time**: 0.000 ms
- **Operations per Second**: 0.00

**Details:**
- signingMemoryIncrease: -19.49 MB
- verifyingMemoryIncrease: 17.06 MB
- totalMemoryIncrease: -2.42 MB

---

## Performance Analysis

- Email signing takes an average of **2.59 ms**
  - ✅ **EXCELLENT**: Signing is very fast (<50ms)
- Email verification takes an average of **1.37 ms**
  - ✅ **EXCELLENT**: Verification is very fast (<50ms)

---

## Recommendations

1. **Signing Performance**: Consider caching private key parsing for repeated operations
2. **Verification Performance**: Batch verification for multiple emails when possible
3. **Large Emails**: For emails >100KB, consider streaming hashing instead of in-memory
4. **Production Use**: Run benchmarks on target deployment environment
