import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseInput } from '../src/adapters';
import type { InputFile } from '../src/core/types';

async function fixture(name: string): Promise<InputFile> {
  return {
    name,
    content: await readFile(join(process.cwd(), 'examples', name), 'utf8'),
  };
}

describe('native configuration adapters', () => {
  it('parses VS Code JSONC and system-wide scope', async () => {
    const result = parseInput(await fixture('vscode-keybindings.json'));
    expect(result.format).toBe('vscode');
    expect(result.bindings).toHaveLength(8);
    expect(result.bindings.find((item) => item.command.includes('openAgents'))?.scope).toBe(
      'global',
    );
  });

  it('parses Zed binding groups and contexts', async () => {
    const result = parseInput(await fixture('zed-keymap.json'));
    expect(result.format).toBe('zed');
    expect(result.bindings).toHaveLength(4);
    expect(result.bindings.every((item) => item.context)).toBe(true);
  });

  it('parses JetBrains keymap XML', async () => {
    const result = parseInput(await fixture('jetbrains-keymap.xml'));
    expect(result.format).toBe('jetbrains');
    expect(result.bindings.map((item) => item.command)).toContain('GotoAction');
  });

  it('parses global and app-specific PowerToys shortcuts', async () => {
    const result = parseInput(await fixture('powertoys-default.json'));
    expect(result.format).toBe('powertoys');
    expect(result.bindings.filter((item) => item.scope === 'global')).toHaveLength(2);
    expect(result.bindings.find((item) => item.scope === 'application')?.application).toBe(
      'code.exe',
    );
  });

  it('parses AutoHotkey directives and line numbers', async () => {
    const result = parseInput(await fixture('global-hotkeys.ahk'));
    expect(result.format).toBe('autohotkey');
    expect(result.bindings).toHaveLength(3);
    expect(result.bindings[2].context).toContain('WinActive');
    expect(result.bindings[0].location.line).toBeGreaterThan(1);
  });
});
