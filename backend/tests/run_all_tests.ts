import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const testsDir = path.resolve(__dirname);
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log(`Discovered ${testFiles.length} test files in backend/tests:\n`);

interface TestResult {
  file: string;
  success: boolean;
  output: string;
  durationMs: number;
  testCount: number;
}

const results: TestResult[] = [];

for (const file of testFiles) {
  const fullPath = path.join(testsDir, file);
  const start = Date.now();
  try {
    const output = execSync(`npx tsx "${fullPath}"`, {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test', ENABLE_DEV_AUTH: 'true' },
      timeout: 90000,
      encoding: 'utf-8'
    });
    const durationMs = Date.now() - start;
    
    // Estimate test count from [PASS] or PASSED or test count lines
    const passMatches = output.match(/\[PASS\]/gi) || [];
    const testCaseMatches = output.match(/✔|TEST \d+/gi) || [];
    const count = Math.max(passMatches.length, testCaseMatches.length, 1);

    results.push({ file, success: true, output, durationMs, testCount: count });
    console.log(`[SUCCESS] ${file} (${durationMs}ms) - ~${count} tests`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const failureDetail = (err.stdout ? String(err.stdout) : '') + (err.stderr ? String(err.stderr) : '');
    results.push({
      file,
      success: false,
      output: failureDetail || err.message,
      durationMs,
      testCount: 0
    });
    console.log(`[FAILED] ${file} (${durationMs}ms): ${err.message?.slice(0, 120)}`);
    if (failureDetail) {
      console.log(`--- Failure Detail for ${file} ---\n${failureDetail.slice(-400)}\n---------------------------------`);
    }
  }
}

console.log('\n--- SUMMARY ---');
const totalPassedFiles = results.filter(r => r.success).length;
console.log(`Passed files: ${totalPassedFiles} / ${testFiles.length}`);
let totalTests = 0;
results.forEach(r => totalTests += r.testCount);
console.log(`Estimated total backend test assertions: ${totalTests}`);
