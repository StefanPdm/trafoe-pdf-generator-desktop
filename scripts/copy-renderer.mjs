import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await fs.cp(path.join(root, 'src', 'renderer'), path.join(root, 'app', 'renderer'), { recursive: true });
