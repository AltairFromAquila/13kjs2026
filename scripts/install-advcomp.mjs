#!/usr/bin/env node

import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const TOOLS_DIR = resolve(repoRoot, 'tools', 'advancecomp');
const RELEASE_API = 'https://api.github.com/repos/amadvance/advancecomp/releases/latest';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

function log(message) {
  console.log(`[advcomp-install] ${message}`);
}

function fail(message) {
  console.error(`[advcomp-install] ERROR: ${message}`);
  process.exit(1);
}

function runCommand(command, commandArgs, options = {}) {
  const printable = `${command} ${commandArgs.join(' ')}`.trim();
  if (dryRun) {
    log(`[dry-run] ${printable}`);
    return { status: 0 };
  }

  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (typeof result.status !== 'number' || result.status !== 0) {
    const code = result.status ?? 'unknown';
    return { status: Number(code) || 1 };
  }

  return { status: 0 };
}

function commandExists(command) {
  const check = spawnSync(command, ['--version'], { stdio: 'ignore', shell: false });
  return check.status === 0;
}

async function downloadToFile(url, targetPath) {
  if (dryRun) {
    log(`[dry-run] download ${url} -> ${targetPath}`);
    return;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': '13kjs2026-advcomp-installer',
      Accept: 'application/octet-stream',
    },
  });

  if (!response.ok || !response.body) {
    fail(`Download failed (${response.status}) for ${url}`);
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const nodeStream = Readable.fromWeb(response.body);
    const writer = createWriteStream(targetPath);
    nodeStream.pipe(writer);

    writer.on('finish', resolvePromise);
    writer.on('error', rejectPromise);
  });
}

function pickWindowsAsset(assets) {
  const arch = process.arch;
  const ext = '.zip';

  const normalized = assets
    .filter((asset) => asset?.browser_download_url && typeof asset.name === 'string')
    .map((asset) => ({
      name: asset.name.toLowerCase(),
      url: asset.browser_download_url,
      originalName: asset.name,
    }))
    .filter((asset) => asset.name.endsWith(ext))
    .filter((asset) => asset.name.includes('win') || asset.name.includes('windows'));

  if (normalized.length === 0) {
    return null;
  }

  const wantsArm64 = arch === 'arm64';
  const wantsX64 = arch === 'x64';

  if (wantsArm64) {
    const armPick = normalized.find((a) => a.name.includes('arm64') || a.name.includes('aarch64'));
    if (armPick) return armPick;
  }

  if (wantsX64) {
    const x64Pick = normalized.find(
      (a) =>
        a.name.includes('x64') ||
        a.name.includes('x86_64') ||
        a.name.includes('amd64') ||
        a.name.includes('win64')
    );
    if (x64Pick) return x64Pick;
  }

  const generic64 = normalized.find((a) => a.name.includes('64'));
  if (generic64) return generic64;

  return normalized[0];
}

async function installWindows() {
  log('Windows detected: installing advancecomp by downloading latest GitHub release asset.');

  log(`Fetching release metadata from ${RELEASE_API}`);
  const releaseResponse = await fetch(RELEASE_API, {
    headers: {
      'User-Agent': '13kjs2026-advcomp-installer',
      Accept: 'application/vnd.github+json',
    },
  });

  if (!releaseResponse.ok) {
    fail(`Could not fetch latest release metadata (${releaseResponse.status}).`);
  }

  const release = await releaseResponse.json();
  const asset = pickWindowsAsset(release.assets || []);

  if (!asset) {
    fail('No Windows .zip asset found in the latest advancecomp release.');
  }

  log(`Selected asset: ${asset.originalName}`);

  const zipPath = resolve(TOOLS_DIR, 'advancecomp.zip');

  if (!dryRun) {
    rmSync(TOOLS_DIR, { recursive: true, force: true });
    mkdirSync(TOOLS_DIR, { recursive: true });
  } else {
    log(`[dry-run] recreate ${TOOLS_DIR}`);
  }

  await downloadToFile(asset.url, zipPath);

  const hasPwsh = commandExists('pwsh');
  const unzipCmd = hasPwsh ? 'pwsh' : 'powershell';
  const unzipArgs = hasPwsh
    ? ['-NoLogo', '-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${TOOLS_DIR}' -Force`]
    : ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${TOOLS_DIR}' -Force`];

  log(`Unzipping with ${unzipCmd}`);
  const unzipResult = runCommand(unzipCmd, unzipArgs);
  if (unzipResult.status !== 0) {
    fail('Failed to unzip advancecomp package on Windows.');
  }

  if (!dryRun && existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  log(`advancecomp extracted to ${TOOLS_DIR}`);
}

function installMacOS() {
  log('macOS detected: attempting command-based installation.');

  if (!commandExists('brew')) {
    fail('Homebrew is not installed. Install brew first, then rerun this script.');
  }

  const result = runCommand('brew', ['install', 'advancecomp']);
  if (result.status !== 0) {
    fail('brew install advancecomp failed.');
  }
}

function installLinux() {
  log('Linux detected: attempting command-based installation.');

  const strategies = [
    { cmd: 'apt-get', args: ['update'] },
    { cmd: 'apt-get', args: ['install', '-y', 'advancecomp'] },
    { cmd: 'dnf', args: ['install', '-y', 'advancecomp'] },
    { cmd: 'yum', args: ['install', '-y', 'advancecomp'] },
    { cmd: 'pacman', args: ['-S', '--noconfirm', 'advancecomp'] },
    { cmd: 'zypper', args: ['--non-interactive', 'install', 'advancecomp'] },
    { cmd: 'apk', args: ['add', 'advancecomp'] },
  ];

  const installedByApt = commandExists('apt-get');
  if (installedByApt) {
    const updateResult = runCommand('apt-get', ['update']);
    if (updateResult.status !== 0) {
      fail('apt-get update failed.');
    }
    const installResult = runCommand('apt-get', ['install', '-y', 'advancecomp']);
    if (installResult.status === 0) {
      return;
    }
  }

  for (const strategy of strategies) {
    if (strategy.cmd === 'apt-get') {
      continue;
    }
    if (!commandExists(strategy.cmd)) {
      continue;
    }

    const result = runCommand(strategy.cmd, strategy.args);
    if (result.status === 0) {
      return;
    }
  }

  fail('Unable to install advancecomp using known Linux package managers.');
}

async function main() {
  log(`Platform: ${process.platform}, Arch: ${process.arch}`);
  if (dryRun) {
    log('Dry-run mode enabled. No changes will be applied.');
  }

  if (process.platform === 'win32') {
    await installWindows();
    return;
  }

  if (process.platform === 'darwin') {
    installMacOS();
    return;
  }

  if (process.platform === 'linux') {
    installLinux();
    return;
  }

  fail(`Unsupported platform: ${process.platform}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
