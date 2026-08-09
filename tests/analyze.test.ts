import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeInputs } from '../src/core/analyze';
import { renderJsonReport } from '../src/core/report';
import type { InputFile } from '../src/core/types';

async function portfolio(): Promise<InputFile[]> {
  const names = [
    'vscode-keybindings.json',
    'zed-keymap.json',
    'jetbrains-keymap.xml',
    'powertoys-default.json',
    'global-hotkeys.ahk',
  ];
  return Promise.all(
    names.map(async (name) => ({
      name,
      content: await readFile(join(process.cwd(), 'examples', name), 'utf8'),
    })),
  );
}

describe('portfolio analysis', () => {
  it('classifies cross-layer conflicts and creates a bounded repair plan', async () => {
    const result = analyzeInputs(await portfolio(), {
      platform: 'windows',
      now: new Date('2000-01-01T00:00:00.000Z'),
    });
    expect(result.summary.bindings).toBe(21);
    expect(result.summary.definite).toBeGreaterThan(0);
    expect(result.summary.shadow).toBeGreaterThan(0);
    expect(result.summary.potential).toBeGreaterThan(0);
    expect(result.summary.reserved).toBeGreaterThan(0);
    expect(result.summary.safeReuses).toBeGreaterThan(0);
    expect(result.summary.suggestions).toBeGreaterThan(0);
    expect(
      result.safeReuses.some((reuse) => reuse.key === 'f5'),
    ).toBe(true);
  });

  it('treats the same application shortcut in different apps as safe reuse', () => {
    const first = JSON.stringify({
      version: 1,
      application: 'App A',
      bindings: [{ key: 'ctrl+j', command: 'one', scope: 'application' }],
    });
    const second = JSON.stringify({
      version: 1,
      application: 'App B',
      bindings: [{ key: 'ctrl+j', command: 'two', scope: 'application' }],
    });
    const result = analyzeInputs(
      [
        { name: 'a.keybind.json', content: first },
        { name: 'b.keybind.json', content: second },
      ],
      { platform: 'windows' },
    );
    expect(result.conflicts).toHaveLength(0);
    expect(result.safeReuses).toHaveLength(1);
  });

  it('reports an unresolved collision when every participant is locked', () => {
    const make = (application: string, command: string) =>
      JSON.stringify({
        version: 1,
        application,
        bindings: [
          {
            key: 'ctrl+alt+d',
            command,
            scope: 'global',
            locked: true,
          },
        ],
      });
    const result = analyzeInputs(
      [
        { name: 'one.keybind.json', content: make('One', 'one') },
        { name: 'two.keybind.json', content: make('Two', 'two') },
      ],
      { platform: 'windows' },
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.suggestions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
  });

  it('renders byte-stable JSON when the analysis timestamp is fixed', async () => {
    const files = await portfolio();
    const options = {
      platform: 'windows' as const,
      now: new Date('2000-01-01T00:00:00.000Z'),
    };
    expect(renderJsonReport(analyzeInputs(files, options))).toBe(
      renderJsonReport(analyzeInputs(files, options)),
    );
  });
});
