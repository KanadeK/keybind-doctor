import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('npm_execpath is missing. Run this through an npm script.');
}
const archive = resolve(projectRoot, 'release', 'keybind-doctor-0.1.0.tgz');
const temporary = await mkdtemp(join(tmpdir(), 'keybind-doctor-package-'));

try {
  const installed = spawnSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--prefix',
      temporary,
      '--omit=dev',
      '--ignore-scripts',
      archive,
      '--registry=https://registry.npmjs.org/',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  );
  if (installed.status !== 0) {
    throw new Error('Archive installation failed:\n' + installed.stderr);
  }

  const cli = resolve(
    temporary,
    'node_modules',
    'keybind-doctor',
    'dist',
    'cli.js',
  );
  const formats = spawnSync(process.execPath, [cli, 'formats'], {
    cwd: temporary,
    encoding: 'utf8',
  });
  if (formats.status !== 0 || !formats.stdout.includes('powertoys')) {
    throw new Error('Installed CLI format smoke failed.');
  }

  const manifest = resolve(temporary, 'smoke.keybind.json');
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      application: 'Package Smoke',
      bindings: [
        {
          key: 'ctrl+alt+j',
          command: 'smoke.run',
          scope: 'application',
        },
      ],
    }),
    'utf8',
  );
  const scan = spawnSync(
    process.execPath,
    [
      cli,
      'scan',
      manifest,
      '--format',
      'json',
      '--deterministic',
      '--fail-on',
      'none',
    ],
    {
      cwd: temporary,
      encoding: 'utf8',
    },
  );
  if (scan.status !== 0) {
    throw new Error('Installed CLI scan failed:\n' + scan.stderr);
  }
  const report = JSON.parse(scan.stdout);
  if (report.summary.bindings !== 1 || report.summary.unresolved !== 0) {
    throw new Error('Installed CLI returned an unexpected smoke summary.');
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write('Installed package smoke passed.\n');
