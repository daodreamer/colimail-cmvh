# CMVH Performance Benchmark Report

Generated: 2025-11-12T14:40:46.140Z
Node.js: v24.4.1
Platform: win32 x64

---

## Summary

| Operation | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |
|-----------|---------------|---------------|---------------|---------|
| Email Signing (small) | 2.509 | 2.098 | 4.935 | 398.60 |
| Email Signing (medium) | 2.269 | 1.999 | 2.707 | 440.66 |
| Email Signing (large) | 2.284 | 2.026 | 2.681 | 437.87 |
| Email Verification (small) | 1.313 | 1.191 | 1.750 | 761.78 |
| Email Verification (medium) | 1.334 | 1.170 | 1.534 | 749.51 |
| Email Verification (large) | 1.273 | 1.150 | 1.553 | 785.49 |
| Email Canonicalization | 0.000 | 0.000 | 0.011 | 5408328.83 |
| Bulk Signing (100 emails) | 188.045 | 180.413 | 199.499 | 5.32 |
| Bulk Verification (100 emails) | 105.272 | 104.606 | 106.229 | 9.50 |
| Memory Usage (1000 emails) | 0.000 | 0.000 | 0.000 | 0.00 |

---

## Detailed Results

### Email Signing (small)

- **Iterations**: 100
- **Total Time**: 250.88 ms
- **Average Time**: 2.509 ms
- **Min Time**: 2.098 ms
- **Max Time**: 4.935 ms
- **Operations per Second**: 398.60

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Signing (medium)

- **Iterations**: 50
- **Total Time**: 113.47 ms
- **Average Time**: 2.269 ms
- **Min Time**: 1.999 ms
- **Max Time**: 2.707 ms
- **Operations per Second**: 440.66

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Signing (large)

- **Iterations**: 20
- **Total Time**: 45.68 ms
- **Average Time**: 2.284 ms
- **Min Time**: 2.026 ms
- **Max Time**: 2.681 ms
- **Operations per Second**: 437.87

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Verification (small)

- **Iterations**: 100
- **Total Time**: 131.27 ms
- **Average Time**: 1.313 ms
- **Min Time**: 1.191 ms
- **Max Time**: 1.750 ms
- **Operations per Second**: 761.78

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Verification (medium)

- **Iterations**: 50
- **Total Time**: 66.71 ms
- **Average Time**: 1.334 ms
- **Min Time**: 1.170 ms
- **Max Time**: 1.534 ms
- **Operations per Second**: 749.51

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Verification (large)

- **Iterations**: 20
- **Total Time**: 25.46 ms
- **Average Time**: 1.273 ms
- **Min Time**: 1.150 ms
- **Max Time**: 1.553 ms
- **Operations per Second**: 785.49

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Canonicalization

- **Iterations**: 1000
- **Total Time**: 0.18 ms
- **Average Time**: 0.000 ms
- **Min Time**: 0.000 ms
- **Max Time**: 0.011 ms
- **Operations per Second**: 5408328.83

**Details:**
- bodyLength: 2850

### Bulk Signing (100 emails)

- **Iterations**: 5
- **Total Time**: 940.23 ms
- **Average Time**: 188.045 ms
- **Min Time**: 180.413 ms
- **Max Time**: 199.499 ms
- **Operations per Second**: 5.32

**Details:**
- emailCount: 100
- parallelExecution: true

### Bulk Verification (100 emails)

- **Iterations**: 5
- **Total Time**: 526.36 ms
- **Average Time**: 105.272 ms
- **Min Time**: 104.606 ms
- **Max Time**: 106.229 ms
- **Operations per Second**: 9.50

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
- signingMemoryIncrease: 4.42 MB
- verifyingMemoryIncrease: -6.13 MB
- totalMemoryIncrease: -1.71 MB

---

## Performance Analysis

- Email signing takes an average of **2.51 ms**
  - ✅ **EXCELLENT**: Signing is very fast (<50ms)
- Email verification takes an average of **1.31 ms**
  - ✅ **EXCELLENT**: Verification is very fast (<50ms)

---

## Recommendations

1. **Signing Performance**: Consider caching private key parsing for repeated operations
2. **Verification Performance**: Batch verification for multiple emails when possible
3. **Large Emails**: For emails >100KB, consider streaming hashing instead of in-memory
4. **Production Use**: Run benchmarks on target deployment environment
