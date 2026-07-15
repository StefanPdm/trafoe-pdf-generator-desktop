import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browsersPath = path.join(root, 'ms-playwright');

const result = spawnSync('npx playwright install chromium', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

// `playwright install chromium` also pulls chromium-headless-shell and
// ffmpeg, neither of which our code uses (no `channel` option, no video
// recording) — pruning them keeps the bundled app smaller.
const entries = await fs.readdir(browsersPath);
for (const entry of entries) {
  if (entry.startsWith('chromium_headless_shell-') || entry.startsWith('ffmpeg-')) {
    await fs.rm(path.join(browsersPath, entry), { recursive: true, force: true });
    console.log(`Removed unused ${entry}`);
  }
}
