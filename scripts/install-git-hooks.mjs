import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// .git/hooks/ isn't tracked by git, so a hook checked into scripts/git-hooks/
// has to be copied into place on every checkout — done here via `npm install`
// (see the "postinstall" script) rather than relying on each dev to run this
// manually.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'scripts', 'git-hooks');
const dest = path.join(root, '.git', 'hooks');

if (!fs.existsSync(dest)) {
  console.log('No .git/hooks directory found (not a git checkout?) — skipping hook install.');
  process.exit(0);
}

for (const name of fs.readdirSync(source)) {
  const destPath = path.join(dest, name);
  fs.copyFileSync(path.join(source, name), destPath);
  fs.chmodSync(destPath, 0o755);
  console.log(`Installed git hook: ${name}`);
}
