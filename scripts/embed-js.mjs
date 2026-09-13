#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const releaseDistDir = path.join(rootDir, 'release', 'dist');
const indexPath = path.join(releaseDistDir, 'index.html');

function fail(message) {
  console.error(`[embed-js] ${message}`);
  process.exit(1);
}

function main() {
  if (!existsSync(releaseDistDir)) {
    fail('release/dist not found. Run prepare:files first.');
  }

  if (!existsSync(indexPath)) {
    fail('release/dist/index.html not found.');
  }

  const jsFiles = readdirSync(releaseDistDir).filter((name) => name.endsWith('.js'));
  if (jsFiles.length !== 1) {
    fail(`Expected exactly one .js file in release/dist, found ${jsFiles.length}.`);
  }

  const jsFileName = jsFiles[0];
  const jsPath = path.join(releaseDistDir, jsFileName);

  const html = readFileSync(indexPath, 'utf8');
  const jsContent = readFileSync(jsPath, 'utf8');
  const safeJsContent = jsContent.replace(/<\/script/gi, '<\\/script');

  const srcPattern = new RegExp(`<script[^>]*src=\\"${jsFileName.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\"[^>]*><\\/script>`, 'i');
  const htmlWithoutExternalScript = html.replace(srcPattern, '');

  const canvasCloseTag = '</canvas>';
  const canvasCloseIndex = htmlWithoutExternalScript.indexOf(canvasCloseTag);
  if (canvasCloseIndex === -1) {
    fail('Could not find </canvas> in release/dist/index.html.');
  }

  const insertAt = canvasCloseIndex + canvasCloseTag.length;
  const inlineScript = `<script>${safeJsContent}</script>`;
  const updatedHtml =
    htmlWithoutExternalScript.slice(0, insertAt) + inlineScript + htmlWithoutExternalScript.slice(insertAt);

  writeFileSync(indexPath, updatedHtml, 'utf8');
  rmSync(jsPath, { force: true });

  console.log('[embed-js] Embedded JS into release/dist/index.html');
  console.log(`[embed-js] Removed ${path.join('release', 'dist', jsFileName)}`);
}

main();
