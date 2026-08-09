import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireClean = process.argv.includes('--require-clean');
const npmCli = process.env.npm_execpath;
const results = [];

if (!npmCli) {
  fail('npm_execpath is missing. Run the gate through "npm run release:check".');
}

for (const script of ['lint', 'typecheck', 'test', 'build', 'verify:examples', 'test:e2e']) {
  run(process.execPath, [npmCli, 'run', script], 'npm run ' + script);
}
run(
  process.execPath,
  [npmCli, 'audit', '--audit-level=low', '--registry=https://registry.npmjs.org/'],
  'npm audit',
);

await checkSourceHygiene();
await checkMarkdownLinks();
await checkPackageContents();

run(process.execPath, ['scripts/package-release.mjs'], 'package pass 1');
const firstChecksums = await readFile(resolve(projectRoot, 'release', 'SHA256SUMS'), 'utf8');
await new Promise((resolveWait) => setTimeout(resolveWait, 1200));
run(process.execPath, ['scripts/package-release.mjs'], 'package pass 2');
const secondChecksums = await readFile(resolve(projectRoot, 'release', 'SHA256SUMS'), 'utf8');
if (firstChecksums !== secondChecksums) {
  fail('Release assets changed across two deliberately separated packaging passes.');
}
results.push('deterministic release assets');
run(process.execPath, ['scripts/smoke-package.mjs'], 'installed package smoke');

checkGitHistory();
if (requireClean) {
  const status = execute('git', ['status', '--porcelain']);
  if (status.status !== 0 || status.stdout.trim()) {
    fail('Git worktree is not clean.');
  }
  results.push('clean git worktree');
}

process.stdout.write(
  [
    '',
    'RELEASE CHECK PASSED',
    ...results.map((item) => '  PASS  ' + item),
    '',
  ].join('\n'),
);

async function checkSourceHygiene() {
  const ignored = new Set([
    '.git',
    'node_modules',
    'dist',
    'site-dist',
    'release',
    'playwright-report',
    'test-results',
  ]);
  const textExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.css',
    '.html',
    '.xml',
    '.ahk',
  ]);
  const files = await walk(projectRoot, ignored);
  const secretPatterns = [
    ['GitHub token', /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
    ['AWS access key', /AKIA[0-9A-Z]{16}/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ];
  for (const filePath of files) {
    if (!textExtensions.has(extname(filePath).toLowerCase())) continue;
    const content = await readFile(filePath, 'utf8');
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(content)) {
        fail(label + ' pattern found in ' + relative(projectRoot, filePath));
      }
    }
    if (
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath) &&
      /(?:describe|it|test)\.(?:only|skip)\s*\(/.test(content)
    ) {
      fail('Focused or skipped test found in ' + relative(projectRoot, filePath));
    }
  }
  const webSource = await readFile(resolve(projectRoot, 'src', 'web', 'App.tsx'), 'utf8');
  if (/[\u2013\u2014]/.test(webSource)) {
    fail('Visible web copy contains a forbidden en dash or em dash.');
  }
  results.push('source and secret hygiene');
}

async function checkPackageContents() {
  const packed = execute(process.execPath, [
    npmCli,
    'pack',
    '--dry-run',
    '--json',
  ]);
  if (packed.status !== 0) fail('npm pack --dry-run failed.');
  const report = JSON.parse(packed.stdout);
  const files = new Set(report[0]?.files?.map((entry) => entry.path));
  for (const required of ['dist/cli.js', 'dist/index.js', 'README.md', 'LICENSE', 'package.json']) {
    if (!files.has(required)) fail('Package is missing ' + required + '.');
  }
  results.push('npm package contents');
}

async function checkMarkdownLinks() {
  const files = (await walk(projectRoot, new Set([
    '.git',
    'node_modules',
    'dist',
    'site-dist',
    'release',
    'playwright-report',
    'test-results',
  ]))).filter((filePath) => extname(filePath).toLowerCase() === '.md');
  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const links = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
    for (const match of links) {
      let target = match[1].trim().split(/\s+"/)[0];
      if (target.startsWith('<') && target.endsWith('>')) {
        target = target.slice(1, -1);
      }
      if (
        !target ||
        target.startsWith('#') ||
        /^(?:https?:|mailto:|data:)/i.test(target)
      ) {
        continue;
      }
      const localTarget = decodeURIComponent(target.split('#')[0]);
      try {
        await access(resolve(dirname(filePath), localTarget));
      } catch {
        fail(
          'Broken Markdown link in ' +
            relative(projectRoot, filePath) +
            ': ' +
            target,
        );
      }
    }
  }
  results.push('local Markdown links');
}

function checkGitHistory() {
  const probe = execute('git', ['rev-parse', '--verify', 'HEAD']);
  if (probe.status !== 0) {
    results.push('git history not created yet');
    return;
  }
  const identities = execute('git', [
    'log',
    '--format=%an%x09%ae%x09%cn%x09%ce',
  ]);
  if (identities.status !== 0) fail('Could not read git identities.');
  for (const line of identities.stdout.trim().split(/\r?\n/)) {
    if (!line) continue;
    const [authorName, authorEmail, committerName, committerEmail] = line.split('\t');
    if (
      authorName !== 'KanadeK' ||
      committerName !== 'KanadeK' ||
      authorEmail !== '121669563+KanadeK@users.noreply.github.com' ||
      committerEmail !== '121669563+KanadeK@users.noreply.github.com'
    ) {
      fail('Unexpected author or committer identity: ' + line);
    }
  }
  const messages = execute('git', ['log', '--format=%B']);
  if (/^Co-authored-by:/im.test(messages.stdout)) {
    fail('Co-authored-by trailer found in git history.');
  }
  results.push('git author and co-author hygiene');
}

function run(command, args, label) {
  const execution = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (execution.status !== 0) fail(label + ' failed with exit code ' + execution.status + '.');
  results.push(label);
}

function execute(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function fail(message) {
  process.stderr.write('RELEASE CHECK FAILED: ' + message + '\n');
  process.exit(1);
}

async function walk(directory, ignored) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(fullPath, ignored)));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}
