# CMVH Performance Benchmark Report

Generated: 2025-11-12T16:35:45.797Z
Node.js: v24.4.1
Platform: win32 x64

---

## Summary

| Operation | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |
|-----------|---------------|---------------|---------------|---------|
| Email Signing (small) | 2.440 | 2.075 | 4.959 | 409.75 |
| Email Signing (medium) | 2.267 | 2.024 | 2.776 | 441.10 |
| Email Signing (large) | 2.290 | 2.058 | 2.941 | 436.66 |
| Email Verification (small) | 1.314 | 1.128 | 2.338 | 761.27 |
| Email Verification (medium) | 1.321 | 1.165 | 1.754 | 756.81 |
| Email Verification (large) | 1.232 | 1.172 | 1.336 | 811.90 |
| Email Canonicalization | 0.000 | 0.000 | 0.013 | 5479452.05 |
| Bulk Signing (100 emails) | 184.159 | 180.683 | 186.262 | 5.43 |
| Bulk Verification (100 emails) | 104.698 | 104.314 | 105.116 | 9.55 |
| Memory Usage (1000 emails) | 0.000 | 0.000 | 0.000 | 0.00 |

---

## Detailed Results

### Email Signing (small)

- **Iterations**: 100
- **Total Time**: 244.05 ms
- **Average Time**: 2.440 ms
- **Min Time**: 2.075 ms
- **Max Time**: 4.959 ms
- **Operations per Second**: 409.75

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Signing (medium)

- **Iterations**: 50
- **Total Time**: 113.35 ms
- **Average Time**: 2.267 ms
- **Min Time**: 2.024 ms
- **Max Time**: 2.776 ms
- **Operations per Second**: 441.10

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Signing (large)

- **Iterations**: 20
- **Total Time**: 45.80 ms
- **Average Time**: 2.290 ms
- **Min Time**: 2.058 ms
- **Max Time**: 2.941 ms
- **Operations per Second**: 436.66

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Verification (small)

- **Iterations**: 100
- **Total Time**: 131.36 ms
- **Average Time**: 1.314 ms
- **Min Time**: 1.128 ms
- **Max Time**: 2.338 ms
- **Operations per Second**: 761.27

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Verification (medium)

- **Iterations**: 50
- **Total Time**: 66.07 ms
- **Average Time**: 1.321 ms
- **Min Time**: 1.165 ms
- **Max Time**: 1.754 ms
- **Operations per Second**: 756.81

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Verification (large)

- **Iterations**: 20
- **Total Time**: 24.63 ms
- **Average Time**: 1.232 ms
- **Min Time**: 1.172 ms
- **Max Time**: 1.336 ms
- **Operations per Second**: 811.90

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Canonicalization

- **Iterations**: 1000
- **Total Time**: 0.18 ms
- **Average Time**: 0.000 ms
- **Min Time**: 0.000 ms
- **Max Time**: 0.013 ms
- **Operations per Second**: 5479452.05

**Details:**
- bodyLength: 2850

### Bulk Signing (100 emails)

- **Iterations**: 5
- **Total Time**: 920.80 ms
- **Average Time**: 184.159 ms
- **Min Time**: 180.683 ms
- **Max Time**: 186.262 ms
- **Operations per Second**: 5.43

**Details:**
- emailCount: 100
- parallelExecution: true

### Bulk Verification (100 emails)

- **Iterations**: 5
- **Total Time**: 523.49 ms
- **Average Time**: 104.698 ms
- **Min Time**: 104.314 ms
- **Max Time**: 105.116 ms
- **Operations per Second**: 9.55

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
- signingMemoryIncrease: -21.53 MB
- verifyingMemoryIncrease: 20.02 MB
- totalMemoryIncrease: -1.50 MB

---

## Performance Analysis

- Email signing takes an average of **2.44 ms**
  - ✅ **EXCELLENT**: Signing is very fast (<50ms)
- Email verification takes an average of **1.31 ms**
  - ✅ **EXCELLENT**: Verification is very fast (<50ms)

---

## Recommendations

1. **Signing Performance**: Consider caching private key parsing for repeated operations
2. **Verification Performance**: Batch verification for multiple emails when possible
3. **Large Emails**: For emails >100KB, consider streaming hashing instead of in-memory
4. **Production Use**: Run benchmarks on target deployment environment
