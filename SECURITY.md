# Security policy

## Supported versions

Security fixes are provided for the latest release.

## Data handling

The browser build has no backend or analytics endpoint. Imported files are read
with the browser File API, analyzed in memory, and discarded when the page is
closed or refreshed. Reports are local Blob downloads.

The CLI reads only paths passed on its command line and writes only an explicit
`--output` target. It never edits source configurations. The package script
only replaces `dist/`, `site-dist/`, and `release/` after resolving them as
direct children of the project root.

## Threat model

Configuration files are untrusted input. Parsers are bounded to text formats,
the browser does not execute imported content, XML parsing does not resolve
external entities, and report renderers treat commands as text.

The project does not claim that a suggested shortcut can always be registered
at runtime. Operating systems, keyboard layouts, accessibility tools, and
unseen applications may still capture keys.

## Dependency policy

`npm audit --audit-level=low` is a release gate. esbuild's required install
script is explicitly pinned and approved. CI uses `npm ci` from the committed
lockfile.

## Reporting

Do not open a public issue for an undisclosed vulnerability. Use GitHub's
private vulnerability reporting flow for this repository. Include:

- affected version and entry point;
- minimal reproduction with redacted configuration;
- impact;
- proposed mitigation if known.

No bounty program is currently offered. Reports will be acknowledged as soon
as practical.
