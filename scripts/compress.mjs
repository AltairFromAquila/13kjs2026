#!/usr/bin/env node

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { archiveFolder } from 'zip-lib';

const rootDir = process.cwd();
const releaseDistDir = path.join(rootDir, 'release', 'dist');
const outZipPath = path.join(rootDir, 'release', 'dist.zip');

function fail(message) {
  console.error(`[compress] ${message}`);
  process.exit(1);
}

function bytes(n) {
  return `${n.toLocaleString('en-US')} B`;
}

function logZipSize(step) {
  if (!existsSync(outZipPath)) {
    fail(`Expected zip file is missing after ${step}: ${outZipPath}`);
  }

  const size = statSync(outZipPath).size;
  console.log(`[compress] ${step}: ${bytes(size)}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const details = stderr || stdout || `Exit code ${result.status}`;
    fail(`${command} ${args.join(' ')} failed: ${details}`);
  }
}

function resolveAdvzipCommand() {
  if (process.platform === 'win32') {
    return path.join(rootDir, 'tools', 'advancecomp', 'advzip.exe');
  }

  return 'advzip';
}

function resolveEctCommand() {
  if (process.platform === 'win32') {
    return path.join(rootDir, 'tools', 'ect', 'ect.exe');
  }

  return path.join(rootDir, 'tools', 'ect', 'Efficient-Compression-Tool', 'build', 'ect');
}

async function main() {
  if (!existsSync(releaseDistDir)) {
    fail('release/dist not found. Run prepare:files first.');
  }

  console.log('[compress] Step 1/3: Creating zip with zip-lib');
  await archiveFolder(releaseDistDir, outZipPath);
  logZipSize('After zip-lib');

  console.log('[compress] Step 2/3: Running advzip --shrink-insane');
  const advzipCommand = resolveAdvzipCommand();
  if (process.platform === 'win32' && !existsSync(advzipCommand)) {
    fail(`advzip executable not found at ${advzipCommand}. Run deps:advcomp first.`);
  }
  run(advzipCommand, ['-z', outZipPath, '--shrink-insane']);
  logZipSize('After advzip');

  console.log('[compress] Step 3/3: Running ect -zip -9 -strip');
  const ectCommand = resolveEctCommand();
  if (!existsSync(ectCommand)) {
    fail(`ECT executable not found at ${ectCommand}. Run deps:ect first.`);
  }
  run(ectCommand, ['-zip', outZipPath, '-9', '-strip']);
  logZipSize('After ect');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
