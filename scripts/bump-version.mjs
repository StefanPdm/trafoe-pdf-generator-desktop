import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const versionPath = path.join(root, 'VERSION');

const current = fs.readFileSync(versionPath, 'utf-8').trim();
// Scaled integer math (not `parseFloat(current) + 0.1`) so repeated bumps
// don't drift onto values like 0.30000000000000004.
const next = (Math.round(parseFloat(current) * 10) + 1) / 10;
fs.writeFileSync(versionPath, `${next.toFixed(1)}\n`);

console.log(`Version bumped: ${current} -> ${next.toFixed(1)}`);
