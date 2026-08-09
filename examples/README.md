# Reproducible example portfolio

These files are synthetic, but each one uses the native configuration shape of
the named application. They intentionally contain:

- a PowerToys and AutoHotkey global collision on `Ctrl+Alt+T`;
- a VS Code system-wide binding that shadows JetBrains `Ctrl+Shift+A`;
- an operating-system reservation on `Win+L`;
- a chord-prefix risk between `Ctrl+K` and `Ctrl+K Ctrl+C`;
- safe reuse of application-scoped shortcuts across different editors;
- complementary VS Code `F5` contexts that are proven disjoint.

Run the complete portfolio:

    node dist/cli.js scan examples/vscode-keybindings.json examples/zed-keymap.json examples/jetbrains-keymap.xml examples/powertoys-default.json examples/global-hotkeys.ahk --platform windows --format text --fail-on none

The process exits `0` because `--fail-on none` is explicit. Remove that option
to exercise the CI-gate exit code of `1`.
