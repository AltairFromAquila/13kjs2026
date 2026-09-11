#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const sourceIndexPath = path.join(distDir, 'index.html');
const releaseDistDir = path.join(rootDir, 'release', 'dist');

function fail(message) {
  console.error(`[prepare-files] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const details = stderr || stdout || `Exit code ${result.status}`;
    fail(`${command} ${args.join(' ')} failed: ${details}`);
  }
}

function getBundleInfoFromIndex(indexHtml) {
  const scriptMatch = indexHtml.match(/<script[^>]*src=\"([^\"]+\.js)\"[^>]*><\/script>/i);
  if (!scriptMatch) {
    fail('Could not find a JavaScript <script src="...js"> tag in dist/index.html');
  }

  const src = scriptMatch[1];
  const cleanSrc = src.split('?')[0].split('#')[0];
  const relativeSrc = cleanSrc.replace(/^\/+/, '');
  const bundlePath = path.join(distDir, relativeSrc);
  if (!existsSync(bundlePath)) {
    fail(`Bundle referenced by index.html does not exist: ${bundlePath}`);
  }

  const bundleFileName = path.basename(cleanSrc);
  const bundleBase = bundleFileName.replace(/\.js$/i, '');

  let hash = bundleBase;
  if (bundleBase.startsWith('index-')) {
    hash = bundleBase.slice('index-'.length);
  } else if (bundleBase.includes('-')) {
    const parts = bundleBase.split('-');
    hash = parts[parts.length - 1] || bundleBase;
  }

  if (hash.length < 3) {
    fail(`Could not derive a 3-character hash from bundle name: ${bundleFileName}`);
  }

  const shortHash = hash.slice(0, 3);
  return {
    scriptSrc: src,
    bundlePath,
    shortHash,
  };
}

function updateIndexScriptTag(indexHtml, oldSrc, newSrc) {
  const escapedOldSrc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactSrcPattern = new RegExp(`<script[^>]*src=\\"${escapedOldSrc}\\"[^>]*><\\/script>`, 'i');

  if (exactSrcPattern.test(indexHtml)) {
    return indexHtml.replace(exactSrcPattern, `<script src=\"${newSrc}\" defer></script>`);
  }

  return indexHtml.replace(
    /<script[^>]*src=\"[^\"]+\.js\"[^>]*><\/script>/i,
    `<script src=\"${newSrc}\" defer></script>`
  );
}

function main() {
  if (!existsSync(sourceIndexPath)) {
    fail('dist/index.html not found. Run Vite build first.');
  }

  const sourceIndexHtml = readFileSync(sourceIndexPath, 'utf8');
  const bundleInfo = getBundleInfoFromIndex(sourceIndexHtml);

  rmSync(releaseDistDir, { recursive: true, force: true });
  mkdirSync(releaseDistDir, { recursive: true });

  const outJsFileName = `${bundleInfo.shortHash}.js`;
  const outJsPath = path.join(releaseDistDir, outJsFileName);

  run('npx', ['roadroller', '-O', '2', '-o', outJsPath, bundleInfo.bundlePath]);

  cpSync(sourceIndexPath, path.join(releaseDistDir, 'index.html'));

  const releaseIndexPath = path.join(releaseDistDir, 'index.html');
  const releaseIndexHtml = readFileSync(releaseIndexPath, 'utf8');
  const updatedIndexHtml = updateIndexScriptTag(releaseIndexHtml, bundleInfo.scriptSrc, outJsFileName);
  writeFileSync(releaseIndexPath, updatedIndexHtml, 'utf8');

  console.log(`[prepare-files] Created ${path.relative(rootDir, releaseDistDir)}`);
  console.log(`[prepare-files] JS output: ${path.join('release', 'dist', outJsFileName)}`);
}

main();
