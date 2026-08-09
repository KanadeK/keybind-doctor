# Input formats

Auto-detection uses filenames, extensions, and top-level structure. Use
`--input-format` when a generic filename is ambiguous.

## VS Code, Cursor, and Windsurf

Input is the user `keybindings.json` JSONC array.

Recognized fields:

- `key`;
- `command`;
- `when`;
- `systemWide`.

Rules whose command starts with `-` are retained as disabled removal rules and
excluded from conflicts. Empty commands are also disabled. `systemWide` rules
are global; their declared `when` is retained as metadata but is not used to
limit scope because VS Code documents that system-wide triggers ignore it.

Filename hints containing `cursor` or `windsurf` select the corresponding
application identity.

## Zed

Input is the user `keymap.json` JSONC array.

Each group contributes:

- optional `context`;
- a `bindings` object from key sequence to action.

Hyphen-separated modifiers are normalized. A `null` action is disabled.
String, array, and object actions receive a stable printable command value.

## JetBrains IDEs

Input is a keymap XML document with a `<keymap>` root.

The adapter reads `<action id>` and every nested `<keyboard-shortcut>`. Both
`first-keystroke` and `second-keystroke` are supported. Mouse shortcuts are not
part of v0.1.0.

Application identity is inferred from names such as `idea`, `webstorm`, and
`pycharm`. An explicit `--application` overrides inference.

## PowerToys Keyboard Manager

Input is the profile `default.json` containing `remapShortcuts`.

The adapter reads:

- `global` and `appSpecific` entries;
- `originalKeys` semicolon-separated Windows virtual-key codes;
- `secondKeyOfChord`;
- `newRemapKeys` or legacy `newKeys`;
- `targetApp` and `operationType`.

Common virtual keys, letters, digits, function keys, numpad keys, and OEM
punctuation are decoded. Unknown codes remain visible as `vk_<number>` instead
of being discarded.

Target processes are preserved for evidence. Common aliases are canonicalized
during overlap checks, for example `code.exe` equals `Visual Studio Code`.

## AutoHotkey v1 and v2

Input is a `.ahk` source file.

Recognized declarations:

- symbol hotkeys such as `^!t::Run "wt.exe"`;
- v2 `Hotkey "^!t", Handler`;
- `#HotIf` blocks;
- common v1 `#IfWin...` blocks;
- key-up suffixes.

Custom combinations containing `&` are reported as warnings because their
dispatch semantics need a separate model. Hotstrings, dynamically constructed
hotkeys, and runtime registration calls outside the recognized `Hotkey` form
are not inferred.

AutoHotkey declarations are globally registered even when a condition narrows
when they fire. Unsupported condition syntax therefore becomes a potential
overlap.

## Portable manifest v1

Use this format for applications without a native adapter or for portfolio
policy.

```json
{
  "version": 1,
  "application": "Demo Recorder",
  "bindings": [
    {
      "key": "ctrl+shift+p",
      "command": "recording.pause",
      "scope": "application",
      "context": "recordingActive && !dialogOpen",
      "enabled": true,
      "locked": false
    }
  ]
}
```

`scope` is `global`, `application`, or `context`. A locked binding participates
in analysis but cannot be selected by the repair solver.

## Provenance

JSON and XML line numbers are located from native key text. AutoHotkey uses the
source line directly. If repeated identical strings make a line ambiguous, the
report can point to the first matching line; command and source file remain
available to disambiguate.
