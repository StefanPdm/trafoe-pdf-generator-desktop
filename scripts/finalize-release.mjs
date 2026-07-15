import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const releaseDir = path.join(root, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');

// electron-builder's "dir" target always names its output folder
// "win-unpacked" — not configurable. That name leaks into the zip a
// colleague extracts, so it's renamed here to the product name before
// zipping.
const productName = 'TRAFOE Katalog Generator';
const finalDir = path.join(releaseDir, productName);
const zipPath = path.join(releaseDir, 'TRAFOE-Katalog-Generator.zip');

if (!fs.existsSync(unpackedDir)) {
  throw new Error(`Expected electron-builder output at ${unpackedDir}, but it was not found.`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Windows Defender's real-time scan briefly locks freshly written/renamed
// executables, so filesystem and shell operations on them can transiently
// fail right after electron-builder or rcedit touch the file. Retry instead
// of failing the whole release build over a race with the AV scanner.
function retry(fn, attempts = 6, delayMs = 1500) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return fn();
    } catch (err) {
      if (i === attempts) throw err;
      sleep(delayMs);
    }
  }
}

fs.rmSync(finalDir, { recursive: true, force: true });
retry(() => {
  try {
    fs.renameSync(unpackedDir, finalDir);
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
    fs.cpSync(unpackedDir, finalDir, { recursive: true });
    fs.rmSync(unpackedDir, { recursive: true, force: true });
  }
});

// electron-builder's own icon embedding (signAndEditExecutable) always
// downloads the winCodeSign archive first, even with no signing cert
// configured — and extracting it fails here with "Cannot create symbolic
// link" (needs Developer Mode or an elevated shell). rcedit itself doesn't
// need that archive, so a vendored copy is invoked directly instead.
const rceditPath = path.join(root, 'scripts', 'vendor', 'rcedit-x64.exe');
const iconPath = path.join(root, 'assets', 'logos', 'Trafoe-Logo-small.ico');
const exePath = path.join(finalDir, `${productName}.exe`);
retry(() => execSync(`"${rceditPath}" "${exePath}" --set-icon "${iconPath}"`, { stdio: 'inherit' }));

// Compress-Archive (not a cross-platform zip lib) is fine here since this
// whole app is Windows-only (electron-builder win target). $ErrorActionPreference
// = 'Stop' turns a locked-file warning into a real process failure instead of
// a silently-swallowed non-terminating error that leaves no zip behind.
retry(() => {
  fs.rmSync(zipPath, { force: true });
  execSync(
    `powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Compress-Archive -Path '${finalDir}' -DestinationPath '${zipPath}' -CompressionLevel Optimal"`,
    { stdio: 'inherit' },
  );
  if (!fs.existsSync(zipPath)) throw new Error('zip was not created');
});

console.log(`Release gepackt: ${zipPath}`);
