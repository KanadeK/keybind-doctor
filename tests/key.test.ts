import { describe, expect, it } from 'vitest';
import {
  parseAutoHotkeySequence,
  parseJetBrainsSequence,
  parseKeySequence,
  parsePowerToysKeys,
} from '../src/core/key';

describe('key normalization', () => {
  it('normalizes aliases and modifier order', () => {
    expect(parseKeySequence('Cmd+Shift+P').canonical).toBe('shift+meta+p');
    expect(parseKeySequence('option+control+Esc').canonical).toBe('ctrl+alt+escape');
  });

  it('preserves chords as ordered strokes', () => {
    const sequence = parseKeySequence('ctrl+k ctrl+c');
    expect(sequence.canonical).toBe('ctrl+k ctrl+c');
    expect(sequence.strokes).toHaveLength(2);
  });

  it('decodes PowerToys virtual key codes', () => {
    expect(parsePowerToysKeys('162;164;84').canonical).toBe('ctrl+alt+t');
    expect(parsePowerToysKeys('91;160;83').canonical).toBe('shift+meta+s');
  });

  it('decodes AutoHotkey and JetBrains forms', () => {
    expect(parseAutoHotkeySequence('^!t').canonical).toBe('ctrl+alt+t');
    expect(parseJetBrainsSequence('ctrl shift K', 'ctrl C').canonical).toBe(
      'ctrl+shift+k ctrl+c',
    );
  });
});
