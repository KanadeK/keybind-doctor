# Failure repair procedure

Do not bypass a failing gate. Repair the smallest failing layer, rerun that
layer, then rerun `npm run release:check`.

## Install fails

Confirm the supported runtime and official registry:

```powershell
node --version
npm --version
npm config get registry
npm ping --registry=https://registry.npmjs.org/
```

Expected Node version is 20 or newer. If the registry is not
`https://registry.npmjs.org/`, the project `.npmrc` should still override it.
Retry:

```powershell
npm ci --registry=https://registry.npmjs.org/
```

If npm reports a pending esbuild install script:

```powershell
npm approve-scripts esbuild --allow-scripts-pin
npm ci
```

Only esbuild is approved because Vite and tsup require its platform binary.

## Typecheck or lint fails

```powershell
npm run typecheck
npm run lint
```

Fix the first reported source location. Do not weaken strict mode or disable a
rule globally to hide a local error.

## Unit or integration tests fail

Run the smallest relevant file:

```powershell
npx vitest run tests/context.test.ts
npx vitest run tests/adapters.test.ts
npx vitest run tests/analyze.test.ts
```

Adapter changes must preserve native format fixtures, source filename, line
number, and warnings. Solver changes must keep results sorted and must test
that a suggestion does not introduce another exact or prefix collision.

## E2E fails or Chromium is missing

```powershell
node node_modules/playwright/cli.js install chromium
npm run test:e2e
```

The preview uses port 42817 and deliberately refuses to reuse an unrelated
server. If the port is occupied, identify and stop only that process, or change
both `baseURL` and `webServer.port` in `playwright.config.ts`.

Failure artifacts are under `test-results/` and `playwright-report/`. Check the
error context and screenshot before changing selectors or layout.

## CLI exits 1

Exit 1 means the tool worked and a finding reached the requested threshold.
Read the report:

```powershell
keybind-doctor scan <files> --format markdown --output report.md --fail-on none
```

Review high-risk findings first. Apply any repair manually in the native tool,
export the config again, and rerun the original command.

## CLI exits 2

Use an explicit format and strict warnings:

```powershell
keybind-doctor scan .\keybindings.json --input-format vscode --strict-warnings --fail-on none
```

Common causes:

- truncated JSON or XML;
- a generic filename whose format cannot be detected;
- an AutoHotkey custom combination using `&`;
- a PowerToys profile without `remapShortcuts`;
- a directory passed where a file is required.

Fix or export the source again. Do not hand-edit a generated PowerToys profile
while Keyboard Manager is active.

## Potential context overlap looks wrong

Regex matches, function calls, and unrecognized operators intentionally return
unknown. Options:

1. keep the potential finding and document the manual proof;
2. simplify an equivalent fixture to supported boolean/equality clauses;
3. contribute a parser extension with disjoint, overlap, and unknown tests.

Never reinterpret unknown as safe without proof.

## Package or checksum fails

```powershell
npm run build
node scripts/package-release.mjs
Get-Content .\release\SHA256SUMS
```

`package-release.mjs` only replaces `release/` after validating that it is a
direct child of the project. It sorts ZIP entries and fixes timestamps. If two
passes differ:

1. inspect both `SHA256SUMS` values;
2. unpack the differing archive into two temporary directories;
3. compare file bytes and archive metadata;
4. remove current-time fields or nondeterministic ordering at the producer;
5. run the complete gate again.

Do not publish a locally rebuilt asset under an existing checksum.

## npm audit fails

```powershell
npm audit --audit-level=low --registry=https://registry.npmjs.org/
npm explain <package>
```

Upgrade the direct dependency or use a narrowly pinned `overrides` entry, then
run all checks. Do not use `npm audit fix --force` without reviewing the major
version changes.

## Git identity or contributor gate fails

Expected identity:

```text
KanadeK <121669563+KanadeK@users.noreply.github.com>
```

Inspect:

```powershell
git log --format="%h %an <%ae> | %cn <%ce>"
git shortlog -sne HEAD
git log --format="%B" | Select-String -Pattern "Co-authored-by:"
```

Do not rewrite published history casually. Before the first public release,
correct a local-only commit with `git commit --amend --reset-author` after
setting the intended name and email, then rerun the full gate.

## GitHub workflow fails

Use the failed job log, reproduce its exact Node version and command locally,
then push a normal repair commit. Pages requires the `pages: write` and
`id-token: write` permissions in `pages.yml`. Releases require `contents:
write`.

After a repair, verify:

1. all CI matrix jobs are green;
2. the Pages URL loads the actual workbench;
3. the tag points to the tested commit;
4. release asset hashes match local `SHA256SUMS`;
5. the GitHub contributor list contains only intended identities.
