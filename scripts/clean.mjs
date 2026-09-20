import { rmSync } from 'node:fs';

// Cross-platform stand-in for `rm -rf dist server.js` (works on Windows too).
const targets = ['dist', 'server.js'];

for (const target of targets) {
  rmSync(new URL(`../${target}`, import.meta.url), { recursive: true, force: true });
}
