/**
 * Performance benchmarks for CMVH operations
 * Measures actual performance and generates concrete metrics report
 */

import { describe, it, expect } from "vitest";
import { signEmail, verifyCMVHHeaders } from "../src/index.js";
import * as fs from "fs";
import * as path from "path";

const testChainId = 42161; // Arbitrum
const testVerifyingContract = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  details?: Record<string, any>;
}

const benchmarkResults: BenchmarkResult[] = [];

/**
 * Run a benchmark with multiple iterations and collect statistics
 */
async function benchmark(
  name: string,
  iterations: number,
  fn: () => Promise<void> | void,
  details?: Record<string, any>
): Promise<BenchmarkResult> {
  const times: number[] = [];
  let totalTime = 0;

  // Warmup run
  await fn();

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = end - start;
    times.push(duration);
    totalTime += duration;
  }

  const avgTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;

  const result: BenchmarkResult = {
    operation: name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
    details,
  };

  benchmarkResults.push(result);
  return result;
}

/**
 * Generate performance report
 */
function generateReport() {
  const reportLines: string[] = [];
  reportLines.push("# CMVH Performance Benchmark Report");
  reportLines.push("");
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push(`Node.js: ${process.version}`);
  reportLines.push(`Platform: ${process.platform} ${process.arch}`);
  reportLines.push("");
  reportLines.push("---");
  reportLines.push("");

  // Summary table
  reportLines.push("## Summary");
  reportLines.push("");
  reportLines.push("| Operation | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |");
  reportLines.push("|-----------|---------------|---------------|---------------|---------|");

  for (const result of benchmarkResults) {
    reportLines.push(
      `| ${result.operation} | ${result.avgTime.toFixed(3)} | ${result.minTime.toFixed(3)} | ${result.maxTime.toFixed(3)} | ${result.opsPerSecond.toFixed(2)} |`
    );
  }

  reportLines.push("");
  reportLines.push("---");
  reportLines.push("");

  // Detailed results
  reportLines.push("## Detailed Results");
  reportLines.push("");

  for (const result of benchmarkResults) {
    reportLines.push(`### ${result.operation}`);
    reportLines.push("");
    reportLines.push(`- **Iterations**: ${result.iterations}`);
    reportLines.push(`- **Total Time**: ${result.totalTime.toFixed(2)} ms`);
    reportLines.push(`- **Average Time**: ${result.avgTime.toFixed(3)} ms`);
    reportLines.push(`- **Min Time**: ${result.minTime.toFixed(3)} ms`);
    reportLines.push(`- **Max Time**: ${result.maxTime.toFixed(3)} ms`);
    reportLines.push(`- **Operations per Second**: ${result.opsPerSecond.toFixed(2)}`);

    if (result.details) {
      reportLines.push("");
      reportLines.push("**Details:**");
      for (const [key, value] of Object.entries(result.details)) {
        reportLines.push(`- ${key}: ${value}`);
      }
    }

    reportLines.push("");
  }

  reportLines.push("---");
  reportLines.push("");

  // Performance analysis
  reportLines.push("## Performance Analysis");
  reportLines.push("");

  const signingResult = benchmarkResults.find((r) => r.operation === "Email Signing (small)");
  const verifyingResult = benchmarkResults.find((r) => r.operation === "Email Verification (small)");

  if (signingResult) {
    reportLines.push(`- Email signing takes an average of **${signingResult.avgTime.toFixed(2)} ms**`);
    if (signingResult.avgTime < 50) {
      reportLines.push("  - ✅ **EXCELLENT**: Signing is very fast (<50ms)");
    } else if (signingResult.avgTime < 100) {
      reportLines.push("  - ✅ **GOOD**: Signing is acceptably fast (<100ms)");
    } else {
      reportLines.push("  - ⚠️ **WARNING**: Signing may be slow for real-time applications");
    }
  }

  if (verifyingResult) {
    reportLines.push(`- Email verification takes an average of **${verifyingResult.avgTime.toFixed(2)} ms**`);
    if (verifyingResult.avgTime < 50) {
      reportLines.push("  - ✅ **EXCELLENT**: Verification is very fast (<50ms)");
    } else if (verifyingResult.avgTime < 100) {
      reportLines.push("  - ✅ **GOOD**: Verification is acceptably fast (<100ms)");
    } else {
      reportLines.push("  - ⚠️ **WARNING**: Verification may be slow for bulk processing");
    }
  }

  reportLines.push("");
  reportLines.push("---");
  reportLines.push("");
  reportLines.push("## Recommendations");
  reportLines.push("");
  reportLines.push("1. **Signing Performance**: Consider caching private key parsing for repeated operations");
  reportLines.push("2. **Verification Performance**: Batch verification for multiple emails when possible");
  reportLines.push("3. **Large Emails**: For emails >100KB, consider streaming hashing instead of in-memory");
  reportLines.push("4. **Production Use**: Run benchmarks on target deployment environment");
  reportLines.push("");

  const reportContent = reportLines.join("\n");

  // Write to file
  const reportPath = path.join(process.cwd(), "benchmark-report.md");
  fs.writeFileSync(reportPath, reportContent, "utf-8");

  console.log(`\n📊 Performance report generated: ${reportPath}\n`);

  return reportContent;
}

describe("Performance Benchmarks", () => {
  const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  const smallEmail = {
    from: "alice@example.com",
    to: "bob@example.com",
    subject: "Test Email",
    body: "Hello, this is a test message.",
  };

  const mediumEmail = {
    from: "sender@example.com",
    to: "receiver@example.com",
    subject: "Medium sized email with longer subject line for testing performance",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50), // ~2.5KB
  };

  const largeEmail = {
    from: "sender@example.com",
    to: "receiver@example.com",
    subject: "Large Email Test",
    body: "Lorem ipsum dolor sit amet. ".repeat(4000), // ~100KB
  };

  describe("Signing Performance", () => {
    it("should benchmark small email signing", async () => {
      const result = await benchmark(
        "Email Signing (small)",
        100,
        async () => {
          await signEmail({
            privateKey: testPrivateKey,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...smallEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(smallEmail).length} bytes`,
          bodyLength: smallEmail.body.length,
        }
      );

      console.log(`\n✓ Small email signing: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(200); // Should be fast
    });

    it("should benchmark medium email signing", async () => {
      const result = await benchmark(
        "Email Signing (medium)",
        50,
        async () => {
          await signEmail({
            privateKey: testPrivateKey,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...mediumEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(mediumEmail).length} bytes`,
          bodyLength: mediumEmail.body.length,
        }
      );

      console.log(`✓ Medium email signing: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(300);
    });

    it("should benchmark large email signing", async () => {
      const result = await benchmark(
        "Email Signing (large)",
        20,
        async () => {
          await signEmail({
            privateKey: testPrivateKey,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...largeEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(largeEmail).length} bytes`,
          bodyLength: largeEmail.body.length,
        }
      );

      console.log(`✓ Large email signing: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(500); // Even large emails should be reasonable
    });
  });

  describe("Verification Performance", () => {
    it("should benchmark small email verification", async () => {
      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...smallEmail,
      });

      const result = await benchmark(
        "Email Verification (small)",
        100,
        async () => {
          await verifyCMVHHeaders({
            headers,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...smallEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(smallEmail).length} bytes`,
          bodyLength: smallEmail.body.length,
        }
      );

      console.log(`✓ Small email verification: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(200);
    });

    it("should benchmark medium email verification", async () => {
      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...mediumEmail,
      });

      const result = await benchmark(
        "Email Verification (medium)",
        50,
        async () => {
          await verifyCMVHHeaders({
            headers,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...mediumEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(mediumEmail).length} bytes`,
          bodyLength: mediumEmail.body.length,
        }
      );

      console.log(`✓ Medium email verification: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(300);
    });

    it("should benchmark large email verification", async () => {
      const headers = await signEmail({
        privateKey: testPrivateKey,
        chainId: testChainId,
        verifyingContract: testVerifyingContract,
        ...largeEmail,
      });

      const result = await benchmark(
        "Email Verification (large)",
        20,
        async () => {
          await verifyCMVHHeaders({
            headers,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...largeEmail,
          });
        },
        {
          emailSize: `${JSON.stringify(largeEmail).length} bytes`,
          bodyLength: largeEmail.body.length,
        }
      );

      console.log(`✓ Large email verification: ${result.avgTime.toFixed(2)}ms avg`);
      expect(result.avgTime).toBeLessThan(500);
    });
  });

  describe("Bulk Operations", () => {
    it("should benchmark signing 100 emails", async () => {
      const result = await benchmark(
        "Bulk Signing (100 emails)",
        5,
        async () => {
          const promises = [];
          for (let i = 0; i < 100; i++) {
            promises.push(
              signEmail({
                privateKey: testPrivateKey,
                chainId: testChainId,
                verifyingContract: testVerifyingContract,
                ...smallEmail,
                subject: `Email ${i}`,
              })
            );
          }
          await Promise.all(promises);
        },
        {
          emailCount: 100,
          parallelExecution: true,
        }
      );

      console.log(`✓ Bulk signing (100 emails): ${result.avgTime.toFixed(2)}ms avg`);
      const avgPerEmail = result.avgTime / 100;
      console.log(`  → ${avgPerEmail.toFixed(2)}ms per email`);
      expect(result.avgTime).toBeLessThan(10000); // 10 seconds for 100 emails
    });

    it("should benchmark verifying 100 emails", async () => {
      // Pre-generate signed emails
      const signedEmails = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          signEmail({
            privateKey: testPrivateKey,
            chainId: testChainId,
            verifyingContract: testVerifyingContract,
            ...smallEmail,
            subject: `Email ${i}`,
          })
        )
      );

      const result = await benchmark(
        "Bulk Verification (100 emails)",
        5,
        async () => {
          const promises = signedEmails.map((headers, i) =>
            verifyCMVHHeaders({
              headers,
              chainId: testChainId,
              verifyingContract: testVerifyingContract,
              ...smallEmail,
              subject: `Email ${i}`,
            })
          );
          await Promise.all(promises);
        },
        {
          emailCount: 100,
          parallelExecution: true,
        }
      );

      console.log(`✓ Bulk verification (100 emails): ${result.avgTime.toFixed(2)}ms avg`);
      const avgPerEmail = result.avgTime / 100;
      console.log(`  → ${avgPerEmail.toFixed(2)}ms per email`);
      expect(result.avgTime).toBeLessThan(10000);
    });
  });

  describe("Memory Usage", () => {
    it("should track memory usage during operations", async () => {
      const initialMemory = process.memoryUsage();

      // Sign 1000 emails
      const signed = [];
      for (let i = 0; i < 1000; i++) {
        const headers = await signEmail({
          privateKey: testPrivateKey,
          chainId: testChainId,
          verifyingContract: testVerifyingContract,
          ...smallEmail,
          subject: `Email ${i}`,
        });
        signed.push(headers);
      }

      const afterSigningMemory = process.memoryUsage();

      // Verify all
      for (let i = 0; i < 1000; i++) {
        await verifyCMVHHeaders({
          headers: signed[i],
          chainId: testChainId,
          verifyingContract: testVerifyingContract,
          ...smallEmail,
          subject: `Email ${i}`,
        });
      }

      const afterVerifyingMemory = process.memoryUsage();

      const signingMemoryIncrease = (afterSigningMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      const verifyingMemoryIncrease = (afterVerifyingMemory.heapUsed - afterSigningMemory.heapUsed) / 1024 / 1024;

      console.log(`\n📊 Memory Usage:`);
      console.log(`  Signing 1000 emails: +${signingMemoryIncrease.toFixed(2)} MB`);
      console.log(`  Verifying 1000 emails: +${verifyingMemoryIncrease.toFixed(2)} MB`);

      benchmarkResults.push({
        operation: "Memory Usage (1000 emails)",
        iterations: 1000,
        totalTime: 0,
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        opsPerSecond: 0,
        details: {
          signingMemoryIncrease: `${signingMemoryIncrease.toFixed(2)} MB`,
          verifyingMemoryIncrease: `${verifyingMemoryIncrease.toFixed(2)} MB`,
          totalMemoryIncrease: `${(signingMemoryIncrease + verifyingMemoryIncrease).toFixed(2)} MB`,
        },
      });

      // Memory usage should be reasonable
      expect(signingMemoryIncrease).toBeLessThan(100); // Less than 100MB for 1000 emails
    });
  });

  // Generate report after all benchmarks
  describe("Report Generation", () => {
    it("should generate performance report", () => {
      const report = generateReport();

      expect(report).toContain("# CMVH Performance Benchmark Report");
      expect(report).toContain("Email Signing (small)");
      expect(report).toContain("Email Verification (small)");
      expect(benchmarkResults.length).toBeGreaterThan(0);

      console.log("\n✅ Performance benchmarks completed!");
      console.log("📄 See benchmark-report.md for detailed results\n");
    });
  });
});
