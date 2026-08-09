import type { KeySequence, KeyStroke, Modifier } from './types';

const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'meta'];

const MODIFIER_ALIASES: Record<string, Modifier> = {
  control: 'ctrl',
  ctl: 'ctrl',
  ctrl: 'ctrl',
  option: 'alt',
  opt: 'alt',
  alt: 'alt',
  shift: 'shift',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
  windows: 'meta',
  meta: 'meta',
};

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  ins: 'insert',
  pgup: 'pageup',
  pgdn: 'pagedown',
  prior: 'pageup',
  next: 'pagedown',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  spacebar: 'space',
  backquote: '`',
  comma: ',',
  period: '.',
  slash: '/',
  semicolon: ';',
  quote: "'",
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  minus: '-',
  equal: '=',
};

function normalizeKeyName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/^key(?=[a-z]$)/i, '')
    .replace(/^digit(?=\d$)/i, '')
    .toLowerCase();
  return KEY_ALIASES[cleaned] ?? cleaned;
}

function canonicalStroke(stroke: KeyStroke): string {
  return [...stroke.modifiers, stroke.key].join('+');
}

function displayPart(value: string): string {
  const names: Record<string, string> = {
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    meta: 'Meta',
    escape: 'Escape',
    enter: 'Enter',
    delete: 'Delete',
    backspace: 'Backspace',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    space: 'Space',
    tab: 'Tab',
    left: 'Left',
    right: 'Right',
    up: 'Up',
    down: 'Down',
  };
  return names[value] ?? (value.length === 1 ? value.toUpperCase() : value);
}

function buildSequence(strokes: KeyStroke[]): KeySequence {
  const canonical = strokes.map(canonicalStroke).join(' ');
  return {
    canonical,
    display: strokes
      .map((stroke) => [...stroke.modifiers, stroke.key].map(displayPart).join('+'))
      .join(' '),
    strokes,
  };
}

export function parseKeySequence(input: string): KeySequence {
  const rawStrokes = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (rawStrokes.length === 0) {
    throw new Error('Shortcut is empty.');
  }

  const strokes = rawStrokes.map((rawStroke) => {
    const parts = rawStroke
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean);
    const modifiers = new Set<Modifier>();
    let key = '';
    for (const part of parts) {
      const modifier = MODIFIER_ALIASES[part.toLowerCase()];
      if (modifier) {
        modifiers.add(modifier);
      } else {
        key = normalizeKeyName(part);
      }
    }
    if (!key) {
      throw new Error(`Shortcut stroke "${rawStroke}" has no non-modifier key.`);
    }
    return {
      modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
      key,
    };
  });

  return buildSequence(strokes);
}

export function parseJetBrainsSequence(first: string, second?: string): KeySequence {
  const parseStroke = (value: string): KeyStroke => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const modifiers = new Set<Modifier>();
    let key = '';
    for (const part of parts) {
      const modifier = MODIFIER_ALIASES[part.toLowerCase()];
      if (modifier) {
        modifiers.add(modifier);
      } else {
        key = normalizeKeyName(part);
      }
    }
    if (!key) {
      throw new Error(`JetBrains keystroke "${value}" has no key.`);
    }
    return {
      modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
      key,
    };
  };
  return buildSequence([parseStroke(first), ...(second ? [parseStroke(second)] : [])]);
}

const POWERTOYS_KEY_CODES: Record<number, string> = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  20: 'capslock',
  27: 'escape',
  32: 'space',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'insert',
  46: 'delete',
  91: 'meta',
  92: 'meta',
  93: 'apps',
  106: 'numpad_multiply',
  107: 'numpad_add',
  109: 'numpad_subtract',
  110: 'numpad_decimal',
  111: 'numpad_divide',
  144: 'numlock',
  145: 'scrolllock',
  160: 'shift',
  161: 'shift',
  162: 'ctrl',
  163: 'ctrl',
  164: 'alt',
  165: 'alt',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

function powerToysCodeName(code: number): string {
  if (POWERTOYS_KEY_CODES[code]) return POWERTOYS_KEY_CODES[code];
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 65 && code <= 90) return String.fromCharCode(code).toLowerCase();
  if (code >= 96 && code <= 105) return `numpad${code - 96}`;
  if (code >= 112 && code <= 135) return `f${code - 111}`;
  return `vk_${code}`;
}

export function parsePowerToysKeys(value: string, secondKeyOfChord?: number): KeySequence {
  const codes = value
    .split(';')
    .map((part) => Number.parseInt(part, 10))
    .filter((code) => Number.isFinite(code));
  const modifiers = new Set<Modifier>();
  let key = '';
  for (const code of codes) {
    const name = powerToysCodeName(code);
    if (MODIFIER_ALIASES[name]) {
      modifiers.add(MODIFIER_ALIASES[name]);
    } else {
      key = name;
    }
  }
  if (!key) {
    throw new Error(`PowerToys key sequence "${value}" has no non-modifier key.`);
  }
  const first: KeyStroke = {
    modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    key,
  };
  const strokes = [first];
  if (secondKeyOfChord) {
    strokes.push({ modifiers: [], key: powerToysCodeName(secondKeyOfChord) });
  }
  return buildSequence(strokes);
}

export function parseAutoHotkeySequence(input: string): KeySequence {
  let value = input.trim();
  value = value.replace(/^[~*$<>]+/, '');
  const modifiers = new Set<Modifier>();
  const symbolMap: Record<string, Modifier> = {
    '^': 'ctrl',
    '!': 'alt',
    '+': 'shift',
    '#': 'meta',
  };
  while (value.length > 0 && symbolMap[value[0]]) {
    modifiers.add(symbolMap[value[0]]);
    value = value.slice(1);
  }
  value = value.replace(/^(L|R)(Ctrl|Alt|Shift|Win)&/i, '');
  const key = normalizeKeyName(value.replace(/[{}]/g, ''));
  if (!key) {
    throw new Error(`AutoHotkey hotkey "${input}" has no key.`);
  }
  return buildSequence([
    {
      modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
      key,
    },
  ]);
}

export function isSequencePrefix(left: KeySequence, right: KeySequence): boolean {
  if (left.strokes.length >= right.strokes.length) return false;
  return left.strokes.every(
    (stroke, index) => canonicalStroke(stroke) === canonicalStroke(right.strokes[index]),
  );
}

export function replaceLastStroke(
  sequence: KeySequence,
  modifiers: Modifier[],
  key: string,
): KeySequence {
  return replaceStroke(sequence, sequence.strokes.length - 1, modifiers, key);
}

export function replaceStroke(
  sequence: KeySequence,
  index: number,
  modifiers: Modifier[],
  key: string,
): KeySequence {
  const strokes = sequence.strokes.map((stroke) => ({
    modifiers: [...stroke.modifiers],
    key: stroke.key,
  }));
  if (!strokes[index]) {
    throw new Error(`Shortcut stroke index ${index} is out of range.`);
  }
  strokes[index] = {
    modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier)),
    key: normalizeKeyName(key),
  };
  return buildSequence(strokes);
}
