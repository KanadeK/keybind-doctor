import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const cli = resolve(projectRoot, 'dist', 'cli.js');
const exampleFiles = [
  'examples/vscode-keybindings.json',
  'examples/zed-keymap.json',
  'examples/jetbrains-keymap.xml',
  'examples/powertoys-default.json',
  'examples/global-hotkeys.ahk',
];
const baseArgs = [
  cli,
  'scan',
  ...exampleFiles,
  '--platform',
  'windows',
  '--format',
  'json',
  '--deterministic',
];

const successful = run([...baseArgs, '--fail-on', 'none']);
assert(successful.status === 0, 'Expected --fail-on none to exit 0.');
const report = JSON.parse(successful.stdout);
const expected = {
  files: 5,
  bindings: 21,
  definite: 2,
  shadow: 7,
  potential: 5,
  reserved: 2,
  safeReuses: 11,
  suggestions: 12,
  unresolved: 0,
};
for (const [key, value] of Object.entries(expected)) {
  assert(
    report.summary[key] === value,
    'Expected summary.' + key + ' to be ' + value + ', received ' + report.summary[key] + '.',
  );
}

const gated = run([...baseArgs, '--fail-on', 'definite']);
assert(gated.status === 1, 'Expected definite findings to exit 1.');

const temporary = await mkdtemp(join(tmpdir(), 'keybind-doctor-'));
try {
  const malformed = join(temporary, 'broken.json');
  await writeFile(malformed, '[{"key":', 'utf8');
  const invalid = run([
    cli,
    'scan',
    malformed,
    '--input-format',
    'vscode',
    '--strict-warnings',
    '--fail-on',
    'none',
  ]);
  assert(invalid.status === 2, 'Expected malformed input to exit 2.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write('Example verification passed: exit codes 0, 1, and 2 exercised.\n');

function run(args) {
  return spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
