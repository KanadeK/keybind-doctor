# Contributing

Thank you for improving Keybind Doctor.

## Setup

```bash
npm ci
npm run check
npm run test:e2e
```

## Adapter contributions

An adapter pull request must include:

1. a synthetic or safely redacted native-format fixture;
2. format auto-detection or a documented explicit format;
3. normalized application, command, key, scope, context, and provenance;
4. malformed and unsupported-input behavior;
5. unit tests and at least one portfolio-level assertion;
6. documentation updates.

Do not commit a real personal config containing usernames, filesystem paths,
tokens, server names, or private commands.

## Solver contributions

Document the invariant being changed. Add cases for overlap, disjointness,
unknown syntax, locked bindings, reserved keys, and secondary collisions.
Results must remain deterministic.

## Pull requests

- Keep changes scoped.
- Run `npm run release:check`.
- Explain user-visible behavior and limits.
- Include no `Co-authored-by` trailer unless repository policy changes.
- Confirm generated release assets are not committed.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
