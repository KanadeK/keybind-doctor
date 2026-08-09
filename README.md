# Keybind Doctor

[![CI](https://github.com/KanadeK/keybind-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/KanadeK/keybind-doctor/actions/workflows/ci.yml)
[![Pages](https://github.com/KanadeK/keybind-doctor/actions/workflows/pages.yml/badge.svg)](https://kanadek.github.io/keybind-doctor/)
[![Release](https://img.shields.io/github/v/release/KanadeK/keybind-doctor)](https://github.com/KanadeK/keybind-doctor/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-f36b36.svg)](LICENSE)

Cross-application shortcut conflict analysis with scope-aware, minimum-change
repair planning.

**[Open the local-first workbench](https://kanadek.github.io/keybind-doctor/)** ·
[中文说明](README.zh-CN.md)

Most shortcut tools compare strings inside one application. Keybind Doctor
imports your real VS Code, Zed, JetBrains, PowerToys, and AutoHotkey
configurations into one portfolio. It then asks the questions that plain
duplicate detection misses:

- Is this shortcut global, application-scoped, or context-scoped?
- Can two `when` or `context` expressions actually be true together?
- Does a global hook shadow a focused application?
- Is a short sequence a prefix of a longer chord?
- Is this reuse proven safe because its scopes never overlap?
- Which unlocked binding can move with the least disruption?

The browser workbench and CLI share the same parser, analyzer, and repair
solver. The browser performs all work locally and never uploads a config.

## Quick start

Requires Node.js 20 or newer.

```bash
git clone https://github.com/KanadeK/keybind-doctor.git
cd keybind-doctor
npm ci
npm run build
node dist/cli.js scan \
  examples/vscode-keybindings.json \
  examples/zed-keymap.json \
  examples/jetbrains-keymap.xml \
  examples/powertoys-default.json \
  examples/global-hotkeys.ahk \
  --platform windows \
  --fail-on none
```

The bundled portfolio contains 21 bindings. Version 0.1.0 deterministically
reports 2 definite conflicts, 7 global shadows, 5 potential conflicts, 2
reserved shortcuts, 11 safe reuses, 12 repair suggestions, and 0 unresolved
repairs.

## Install the release CLI

Download `keybind-doctor-0.1.0.tgz` and `SHA256SUMS` from the
[latest release](https://github.com/KanadeK/keybind-doctor/releases/latest),
verify the checksum, then install the archive.

```bash
sha256sum -c SHA256SUMS
npm install --global ./keybind-doctor-0.1.0.tgz
keybind-doctor formats
```

PowerShell:

```powershell
Get-FileHash .\keybind-doctor-0.1.0.tgz -Algorithm SHA256
npm install --global .\keybind-doctor-0.1.0.tgz
keybind-doctor formats
```

Compare the PowerShell hash with the matching line in `SHA256SUMS`.

## CLI

```text
keybind-doctor scan <files...> [options]

--platform <windows|macos|linux>
--input-format <auto|vscode|zed|jetbrains|powertoys|autohotkey|manifest>
--application <name>
--format <text|json|markdown|csv>
-o, --output <file>
--fail-on <definite|potential|none>
--no-plan
--strict-warnings
--deterministic
```

Examples:

```bash
# Human-readable diagnosis without a CI failure
keybind-doctor scan ~/.config/Code/User/keybindings.json --fail-on none

# Combine editor and system-wide layers, then export a repair report
keybind-doctor scan keybindings.json default.json global-hotkeys.ahk \
  --platform windows \
  --format markdown \
  --output shortcut-report.md \
  --fail-on potential

# Produce byte-stable JSON for a checked-in fixture
keybind-doctor scan portfolio.keybind.json \
  --format json \
  --deterministic \
  --fail-on none
```

### Exit codes

| Code | Meaning | Typical response |
| ---: | --- | --- |
| `0` | No finding reached the selected threshold | Continue |
| `1` | A finding reached `--fail-on` | Review the report or select a different explicit threshold |
| `2` | Input, parsing, or execution failed | Follow the [repair guide](docs/repair.md) |

`--fail-on definite` is the default. `reserved` findings only reach that
threshold when the operating-system rule is marked hard.

## Supported inputs

| Adapter | Native input | Scope support | Notable behavior |
| --- | --- | --- | --- |
| VS Code family | JSONC `keybindings.json` | App, context, `systemWide` | Cursor and Windsurf names are inferred from filenames |
| Zed | JSONC `keymap.json` | App and context | Binding groups and key sequences are preserved |
| JetBrains IDEs | Keymap XML | App | First and second keystrokes are parsed |
| PowerToys | Keyboard Manager `default.json` | Global and app-specific | Windows virtual-key codes and target processes are decoded |
| AutoHotkey | v1/v2 `.ahk` declarations | Global and conditional global | `#HotIf` and common `#IfWin...` conditions are retained |
| Portable manifest | `*.keybind.json` schema v1 | All scopes | Adds `locked` and `enabled` controls for portfolio policy |

See [format details and limitations](docs/formats.md).

## Finding model

| Finding | Meaning |
| --- | --- |
| Definite | The same complete shortcut can activate two commands in an overlapping scope |
| Shadow | A global handler can capture a key before an app-scoped handler receives it |
| Potential | A chord prefix or unproven context overlap needs human review |
| Reserved | The target operating system owns or commonly uses the shortcut |
| Safe reuse | The same key is proven non-overlapping by application or context |

The solver never edits source configs. It searches a bounded, deterministic
candidate space, moves the narrowest unlocked binding first, preserves command
and context, and rejects any candidate that creates an exact or prefix
collision.

## Browser workbench

The GitHub Pages build is the real application, not a mockup:

1. Drop one or more native config files.
2. Select Windows, macOS, or Linux.
3. Inspect line-level evidence for each finding.
4. Switch between findings, repair plan, and safe reuse.
5. Download JSON or Markdown.

No backend, analytics, account, config write, or runtime registration is
present. Files remain in browser memory. See the [security model](SECURITY.md).

## Acceptance

Run the same gates used before a release:

```bash
npm ci
npm run verify:examples
npm run check
npm run test:e2e
npm run package
npm run release:check
```

`npm run verify:examples` exercises exit codes 0, 1, and 2. The release gate
also runs lint, strict type checking, 17 unit/integration tests, 10 desktop and
mobile E2E checks, an npm audit at low severity, source/secret checks, package
content checks, and two deliberately separated byte comparisons of release
assets.

Generated assets:

- `release/keybind-doctor-0.1.0.tgz`: installable CLI and library
- `release/keybind-doctor-web-v0.1.0.zip`: static browser build
- `release/release-manifest.json`: machine-readable hashes
- `release/SHA256SUMS`: release verification

If a command fails, use [docs/repair.md](docs/repair.md). It maps each gate and
exit code to a repair and clean rerun.

## Architecture and research

- [Architecture and solver invariants](docs/architecture.md)
- [Native format notes](docs/formats.md)
- [Competitive research and product gap](docs/research.md)
- [Failure repair procedure](docs/repair.md)
- [Security model](SECURITY.md)

The research does not claim that no similar repository can exist. It records
the search date, queries, nearby tools, and the narrower gap this project is
designed to fill.

## Deliberate limits

- This is config-first analysis, not a runtime hotkey registration inspector.
- Default bindings are only analyzed when supplied as an input.
- Regex, function calls, and unsupported context syntax are classified as
  potential overlap instead of guessed safe.
- Key normalization follows virtual-key semantics and cannot infer every
  physical keyboard layout.
- Suggestions are plans, never automatic source rewrites.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Adapter fixtures must be
synthetic or safely redacted, and every new format needs parser, provenance,
analysis, and failure tests.

MIT licensed. Built to make a keyboard portfolio explainable before it becomes
muscle-memory debt.
