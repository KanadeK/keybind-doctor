# Competitive research and product gap

Research snapshot: **2026-08-09**.

This document records a reproducible opportunity assessment. Search results can
never prove that no similar code exists, and GitHub popularity cannot be
guaranteed. The narrower claim is that the reviewed projects did not combine
native multi-app config import, scope-aware overlap proof, chord-prefix
analysis, and deterministic minimum-change repair planning.

## Search method

The workspace inventory was checked first to avoid repeating existing local
projects. GitHub and web searches then used combinations of:

- `keyboard shortcut conflict`;
- `keybinding analyzer`;
- `hotkey conflict detector`;
- `cross app shortcut manager`;
- `shortcut portfolio`;
- format-specific queries for VS Code, Zed, JetBrains, PowerToys, and
  AutoHotkey.

Exact-name searches for `keybind-doctor` found no GitHub repository, and the npm
registry returned package-not-found before initialization.

## Nearby projects

| Project | What it does well | Gap relative to Keybind Doctor |
| --- | --- | --- |
| [HotkeyClash](https://github.com/Wunderlandmedia/HotkeyClash) | Scans macOS runtime and several macOS automation configurations | macOS-only; focuses on discovery; does not produce a cross-platform minimum-change config plan |
| [Keycheck](https://keycheck.dev/) | Searchable database of shortcuts across many products for product designers | Reference database rather than import and analysis of a user's actual configs |
| [PowerToys Keyboard Manager](https://github.com/microsoft/PowerToys/wiki/Keyboard-Manager) | Remaps Windows keys and shortcuts globally or per app | Manages its own layer; it does not import and reason across editor and script configs |
| [VS Code shortcut tools](https://code.visualstudio.com/docs/configure/keybindings) | VS Code can show same-key rules and troubleshoot dispatch | Limited to VS Code's own rule set and runtime |
| [Zed key bindings](https://zed.dev/docs/key-bindings) | Context-specific bindings and key sequences | Editor-local configuration rather than a cross-app portfolio |
| [JetBrains keymaps](https://www.jetbrains.com/help/idea/configuring-keyboard-and-mouse-shortcuts.html) | Rich IDE keymap customization | IDE-local conflict handling |
| [AutoHotkey hotkeys](https://www.autohotkey.com/docs/v2/Hotkeys.htm) | Flexible conditional, global automation | Registration language, not a portfolio analyzer |

The closest GitHub exact-query results were small or single-environment tools,
including a Linux-oriented keybind audit. That evidence encouraged the
multi-format direction but is not treated as proof of global uniqueness.

## User pain evidence

The underlying failure occurs between layers:

- VS Code notes that the same shortcut can move in and out of scope as context
  changes, and system-wide shortcuts can fail when another application or the
  OS owns the key.
- Zed exposes context-specific bindings and multi-stroke sequences.
- JetBrains documents cases where third-party macOS hotkeys capture IDE
  shortcuts.
- Community questions repeatedly ask how to reason about conflicts between the
  window manager, desktop environment, editor, terminal, and automation tools.

Examples:

- [macOS hotkey help discussion](https://www.reddit.com/r/macapps/comments/1s6hvqk/hotkeys_help/)
- [Linux shortcut conflict discussion](https://www.reddit.com/r/linuxquestions/comments/1kcaum4)
- [VS Code and browser shortcut conflict discussion](https://www.reddit.com/r/Frontend/comments/1pga8le/does_anyone_else_keep_running_into_vs_code/)
- [JetBrains macOS capture guidance](https://youtrack.jetbrains.com/projects/IJPL/articles/SUPPORT-A-3871/Keyboard-shortcut-does-not-work-on-macOS-System-wide-hotkey-captured-by-third-party-application)

## Product wedge

The initial wedge is "bring your actual configs, get one evidence-backed
portfolio." It is narrow enough to ship yet deep enough to be useful:

1. five native formats plus a portable manifest;
2. line-level provenance;
3. conservative context reasoning;
4. global shadow and chord-prefix detection;
5. explainable, collision-checked suggestions;
6. CLI exit codes for dotfiles and CI;
7. local-only browser workflow for users who do not want to install a tool.

## Why it may earn attention

These are hypotheses, not promises:

- shortcut conflicts affect several large developer ecosystems;
- the browser demo reaches value without account setup;
- a JSON or Markdown diagnosis is easy to share in issues and dotfile
  repositories;
- adapters provide clear contribution units;
- deterministic fixtures make new-format pull requests reviewable;
- the project does useful work without sending personal configs to a service.

Useful post-release metrics are unique Pages sessions, example completion,
release downloads, adapter requests, issues with reproducible configs, and
external contributors. Star count is an outcome, not an acceptance test.

## Revisit triggers

Repeat the research before a major adapter or positioning change. In
particular, reassess if a mature cross-platform tool adds native import,
three-valued context proof, and repair planning, or if user feedback shows that
runtime registration is a stronger need than config analysis.
