import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['dist', 'site-dist', 'release'].map((name) => resolve(projectRoot, name));

for (const target of targets) {
  if (dirname(target) !== projectRoot) {
    throw new Error('Refusing to clean a path outside the project root: ' + target);
  }
  await rm(target, { recursive: true, force: true });
}
