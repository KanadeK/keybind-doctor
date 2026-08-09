import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(projectRoot, 'release');
const siteDir = resolve(projectRoot, 'site-dist');
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
const fixedTime = new Date('2000-01-01T00:00:00.000Z');

if (dirname(releaseDir) !== projectRoot) {
  throw new Error('Refusing to replace a release directory outside the project root.');
}
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('npm_execpath is missing. Run this through "npm run package".');
}
const pack = spawnSync(
  process.execPath,
  [npmCli, 'pack', '--json', '--pack-destination', releaseDir],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
if (pack.status !== 0) {
  throw new Error('npm pack failed with exit code ' + String(pack.status));
}
const packed = JSON.parse(pack.stdout);
const packageFilename = packed[0]?.filename;
if (!packageFilename) {
  throw new Error('npm pack did not report an output filename.');
}

const zipEntries = {};
for (const filePath of await walk(siteDir)) {
  const name =
    'keybind-doctor-web-v' +
    packageJson.version +
    '/' +
    relative(siteDir, filePath).split(sep).join('/');
  zipEntries[name] = [
    new Uint8Array(await readFile(filePath)),
    { mtime: fixedTime, level: 9 },
  ];
}
const webFilename = 'keybind-doctor-web-v' + packageJson.version + '.zip';
await writeFile(resolve(releaseDir, webFilename), zipSync(zipEntries, { level: 9 }));

const primaryFiles = [packageFilename, webFilename].sort();
const manifest = {
  schemaVersion: 1,
  version: packageJson.version,
  files: await Promise.all(
    primaryFiles.map(async (name) => ({
      name,
      sha256: await sha256(resolve(releaseDir, name)),
    })),
  ),
};
const manifestFilename = 'release-manifest.json';
await writeFile(
  resolve(releaseDir, manifestFilename),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8',
);

const checksumFiles = [...primaryFiles, manifestFilename].sort();
const checksumLines = await Promise.all(
  checksumFiles.map(async (name) => {
    return (await sha256(resolve(releaseDir, name))) + '  ' + name;
  }),
);
await writeFile(
  resolve(releaseDir, 'SHA256SUMS'),
  checksumLines.join('\n') + '\n',
  'utf8',
);

process.stdout.write(
  [
    'Release package ready:',
    ...checksumLines.map((line) => '  ' + line),
    '',
  ].join('\n'),
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(fullPath)));
    else if (entry.isFile()) paths.push(fullPath);
  }
  return paths;
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  hash.update(await readFile(filePath));
  return hash.digest('hex');
}
