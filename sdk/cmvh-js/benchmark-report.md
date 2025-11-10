# CMVH Performance Benchmark Report

Generated: 2025-11-10T18:06:56.155Z
Node.js: v24.4.1
Platform: win32 x64

---

## Summary

| Operation | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |
|-----------|---------------|---------------|---------------|---------|
| Email Signing (small) | 2.572 | 2.178 | 4.755 | 388.85 |
| Email Signing (medium) | 2.483 | 2.196 | 2.909 | 402.81 |
| Email Signing (large) | 5.671 | 5.362 | 6.126 | 176.34 |
| Email Verification (small) | 1.289 | 1.153 | 1.954 | 775.74 |
| Email Verification (medium) | 1.460 | 1.333 | 1.769 | 684.77 |
| Email Verification (large) | 4.645 | 4.385 | 5.227 | 215.27 |
| Email Canonicalization | 0.000 | 0.000 | 0.023 | 4520795.66 |
| Bulk Signing (100 emails) | 186.254 | 184.914 | 187.608 | 5.37 |
| Bulk Verification (100 emails) | 106.142 | 105.024 | 107.101 | 9.42 |
| Memory Usage (1000 emails) | 0.000 | 0.000 | 0.000 | 0.00 |

---

## Detailed Results

### Email Signing (small)

- **Iterations**: 100
- **Total Time**: 257.17 ms
- **Average Time**: 2.572 ms
- **Min Time**: 2.178 ms
- **Max Time**: 4.755 ms
- **Operations per Second**: 388.85

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Signing (medium)

- **Iterations**: 50
- **Total Time**: 124.13 ms
- **Average Time**: 2.483 ms
- **Min Time**: 2.196 ms
- **Max Time**: 2.909 ms
- **Operations per Second**: 402.81

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Signing (large)

- **Iterations**: 20
- **Total Time**: 113.42 ms
- **Average Time**: 5.671 ms
- **Min Time**: 5.362 ms
- **Max Time**: 6.126 ms
- **Operations per Second**: 176.34

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Verification (small)

- **Iterations**: 100
- **Total Time**: 128.91 ms
- **Average Time**: 1.289 ms
- **Min Time**: 1.153 ms
- **Max Time**: 1.954 ms
- **Operations per Second**: 775.74

**Details:**
- emailSize: 114 bytes
- bodyLength: 30

### Email Verification (medium)

- **Iterations**: 50
- **Total Time**: 73.02 ms
- **Average Time**: 1.460 ms
- **Min Time**: 1.333 ms
- **Max Time**: 1.769 ms
- **Operations per Second**: 684.77

**Details:**
- emailSize: 2997 bytes
- bodyLength: 2850

### Email Verification (large)

- **Iterations**: 20
- **Total Time**: 92.91 ms
- **Average Time**: 4.645 ms
- **Min Time**: 4.385 ms
- **Max Time**: 5.227 ms
- **Operations per Second**: 215.27

**Details:**
- emailSize: 112096 bytes
- bodyLength: 112000

### Email Canonicalization

- **Iterations**: 1000
- **Total Time**: 0.22 ms
- **Average Time**: 0.000 ms
- **Min Time**: 0.000 ms
- **Max Time**: 0.023 ms
- **Operations per Second**: 4520795.66

**Details:**
- bodyLength: 2850

### Bulk Signing (100 emails)

- **Iterations**: 5
- **Total Time**: 931.27 ms
- **Average Time**: 186.254 ms
- **Min Time**: 184.914 ms
- **Max Time**: 187.608 ms
- **Operations per Second**: 5.37

**Details:**
- emailCount: 100
- parallelExecution: true

### Bulk Verification (100 emails)

- **Iterations**: 5
- **Total Time**: 530.71 ms
- **Average Time**: 106.142 ms
- **Min Time**: 105.024 ms
- **Max Time**: 107.101 ms
- **Operations per Second**: 9.42

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
- signingMemoryIncrease: 4.48 MB
- verifyingMemoryIncrease: -0.96 MB
- totalMemoryIncrease: 3.51 MB

---

## Performance Analysis

- Email signing takes an average of **2.57 ms**
  - ✅ **EXCELLENT**: Signing is very fast (<50ms)
- Email verification takes an average of **1.29 ms**
  - ✅ **EXCELLENT**: Verification is very fast (<50ms)

---

## Recommendations

1. **Signing Performance**: Consider caching private key parsing for repeated operations
2. **Verification Performance**: Batch verification for multiple emails when possible
3. **Large Emails**: For emails >100KB, consider streaming hashing instead of in-memory
4. **Production Use**: Run benchmarks on target deployment environment
