#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');
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

function listAssetJsFiles() {
  if (!existsSync(assetsDir)) {
    fail('dist/assets not found. Run Vite build first.');
  }

  const jsFiles = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));

  if (jsFiles.length === 0) {
    fail('No .js files found in dist/assets.');
  }

  return jsFiles;
}

function getShortTokenFromFileName(fileName) {
  const bundleBase = fileName.replace(/\.js$/i, '');
  let token = bundleBase;

  if (bundleBase.startsWith('index-')) {
    token = bundleBase.slice('index-'.length);
  } else if (bundleBase.includes('-')) {
    const parts = bundleBase.split('-');
    token = parts[parts.length - 1] || bundleBase;
  }

  if (token.length < 3) {
    fail(`Could not derive a 3-character short token from bundle name: ${fileName}`);
  }

  return token;
}

function buildShortFileNameMap(fileNames) {
  const used = new Set();
  const map = new Map();

  for (const fileName of fileNames) {
    const token = getShortTokenFromFileName(fileName);
    let short = token.slice(0, 3);

    let width = 4;
    while (used.has(short) && width <= token.length) {
      short = token.slice(0, width);
      width += 1;
    }

    if (used.has(short)) {
      let counter = 2;
      let candidate = `${short}${counter}`;
      while (used.has(candidate)) {
        counter += 1;
        candidate = `${short}${counter}`;
      }
      short = candidate;
    }

    used.add(short);
    map.set(fileName, `${short}.js`);
  }

  return map;
}

function replaceAssetReferences(content, fileNameMap) {
  let updated = content;

  for (const [oldFileName, newFileName] of fileNameMap) {
    updated = updated.replaceAll(`/assets/${oldFileName}`, newFileName);
    updated = updated.replaceAll(`assets/${oldFileName}`, newFileName);
    updated = updated.replaceAll(oldFileName, newFileName);
  }

  return updated;
}

function rewriteJsAssetReferences(bundlePath, fileNameMap) {
  const js = readFileSync(bundlePath, 'utf8');
  const updated = replaceAssetReferences(js, fileNameMap);

  if (updated !== js) {
    writeFileSync(bundlePath, updated, 'utf8');
  }
}

function rewriteImportMetaUrlBase(bundlePath) {
  const js = readFileSync(bundlePath, 'utf8');
  const updated = js.replace(
    /new URL\((['"][^'"]+\.js['"])\s*,\s*(?:""|'')\s*\+\s*import\.meta\.url\)/g,
    'new URL($1,location.href)'
  );

  if (updated !== js) {
    writeFileSync(bundlePath, updated, 'utf8');
  }
}

function replaceConstWithLet(bundlePath) {
  const js = readFileSync(bundlePath, 'utf8');
  const matches = js.match(/const\s/g);
  if (!matches || matches.length === 0) {
    return 0;
  }

  const replaced = js.replaceAll('const ', 'let ');
  writeFileSync(bundlePath, replaced, 'utf8');
  return matches.length;
}

function main() {
  if (!existsSync(sourceIndexPath)) {
    fail('dist/index.html not found. Run Vite build first.');
  }

  const sourceIndexHtml = readFileSync(sourceIndexPath, 'utf8');
  const jsFiles = listAssetJsFiles();
  const fileNameMap = buildShortFileNameMap(jsFiles);

  rmSync(releaseDistDir, { recursive: true, force: true });
  mkdirSync(releaseDistDir, { recursive: true });

  let totalConstReplacements = 0;

  for (const jsFileName of jsFiles) {
    const sourceJsPath = path.join(assetsDir, jsFileName);
    const tempJsPath = path.join(releaseDistDir, `__tmp__${jsFileName}`);
    const outJsFileName = fileNameMap.get(jsFileName);

    if (!outJsFileName) {
      fail(`No mapped output filename found for ${jsFileName}`);
    }

    const outJsPath = path.join(releaseDistDir, outJsFileName);

    cpSync(sourceJsPath, tempJsPath);
    rewriteJsAssetReferences(tempJsPath, fileNameMap);
    rewriteImportMetaUrlBase(tempJsPath);

    const replacements = replaceConstWithLet(tempJsPath);
    totalConstReplacements += replacements;

    run('npx', ['roadroller', '-O', '2', '-o', outJsPath, tempJsPath]);
    rmSync(tempJsPath, { force: true });
  }

  console.log(`[prepare-files] Replaced const declarations: ${totalConstReplacements}`);

  cpSync(sourceIndexPath, path.join(releaseDistDir, 'index.html'));

  const releaseIndexPath = path.join(releaseDistDir, 'index.html');
  const releaseIndexHtml = readFileSync(releaseIndexPath, 'utf8');
  const updatedIndexHtml = replaceAssetReferences(releaseIndexHtml, fileNameMap);
  writeFileSync(releaseIndexPath, updatedIndexHtml, 'utf8');

  console.log(`[prepare-files] Created ${path.relative(rootDir, releaseDistDir)}`);
  for (const [oldFileName, newFileName] of fileNameMap) {
    console.log(`[prepare-files] JS output: ${path.join('release', 'dist', newFileName)} (from ${oldFileName})`);
  }
}

main();
