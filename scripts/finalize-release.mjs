import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const releaseDir = path.join(root, 'release');
const exePath = path.join(releaseDir, 'TRAFOE-Katalog-Generator.exe');

// The "portable" NSIS target already produces a single, correctly-named
// (via portable.artifactName), correctly-iconed (via win.icon, embedded by
// NSIS's own compiler — not rcedit, which corrupts NSIS's appended payload
// if run on it afterward) .exe directly in release/. There's nothing left
// to rename, icon-patch, or zip — unlike the old "dir" target, which needed
// all three.
if (!fs.existsSync(exePath)) {
  throw new Error(`Expected electron-builder output at ${exePath}, but it was not found.`);
}

// electron-builder still writes its intermediate unpacked app here on the
// way to building the portable exe (see appOutDir in the build log) — not
// needed afterward, just clutter.
const unpackedDir = path.join(releaseDir, 'win-unpacked');
fs.rmSync(unpackedDir, { recursive: true, force: true });

// The portable exe itself only shows visible feedback (the NSIS splash)
// once enough of it has been read off the network drive and cleared by AV
// scanning to start executing — which can take 30+ seconds on its own,
// before any of the exe's own code (including the splash) can run. This
// launcher gives instant feedback (it's a few hundred bytes, no scan delay)
// and starts the real exe in the background.
fs.copyFileSync(
  path.join(root, 'assets', 'Start-TRAFOE-Katalog-Generator.bat'),
  path.join(releaseDir, 'Start-TRAFOE-Katalog-Generator.bat'),
);

// Shortcut creation logic lives here rather than inline in the .bat: an
// equivalent single-line -Command string was too fragile to maintain
// reliably under cmd.exe's quoting rules.
fs.copyFileSync(
  path.join(root, 'assets', 'create-shortcut.ps1'),
  path.join(releaseDir, 'create-shortcut.ps1'),
);

// Shipped as its own small file rather than having the launcher pull the
// icon out of the .exe: extracting an icon resource from a 245MB file that
// may still be mid-read/AV-scan over a network drive was unreliable in
// testing (shortcut created fine, icon silently stayed blank). A ~4KB .ico
// reads instantly even under the same conditions.
fs.copyFileSync(
  path.join(root, 'assets', 'logos', 'Trafoe-Logo-small.ico'),
  path.join(releaseDir, 'Trafoe-Logo-small.ico'),
);

console.log(`Release fertig: ${exePath}`);
