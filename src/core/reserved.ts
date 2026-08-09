import type { KeySequence, Platform } from './types';

export interface ReservedShortcut {
  key: string;
  label: string;
  hard: boolean;
}

const RESERVED: Record<Platform, ReservedShortcut[]> = {
  windows: [
    { key: 'ctrl+alt+delete', label: 'Windows secure attention sequence', hard: true },
    { key: 'meta+l', label: 'Lock the PC', hard: true },
    { key: 'alt+tab', label: 'Switch applications', hard: true },
    { key: 'meta+tab', label: 'Open Task View', hard: true },
    { key: 'shift+meta+s', label: 'Open screen snipping', hard: false },
    { key: 'meta+v', label: 'Open clipboard history', hard: false },
  ],
  macos: [
    { key: 'meta+space', label: 'Open Spotlight', hard: false },
    { key: 'meta+tab', label: 'Switch applications', hard: true },
    { key: 'shift+meta+3', label: 'Capture the screen', hard: false },
    { key: 'shift+meta+4', label: 'Capture a selected area', hard: false },
    { key: 'shift+meta+5', label: 'Open Screenshot', hard: false },
    { key: 'ctrl+meta+q', label: 'Lock the screen', hard: true },
  ],
  linux: [
    { key: 'alt+f2', label: 'Common desktop run dialog', hard: false },
    { key: 'ctrl+alt+delete', label: 'Common desktop session action', hard: false },
    { key: 'ctrl+alt+t', label: 'Common desktop terminal shortcut', hard: false },
    { key: 'meta+l', label: 'Common desktop lock shortcut', hard: false },
  ],
};

export function findReservedShortcut(
  sequence: KeySequence,
  platform: Platform,
): ReservedShortcut | undefined {
  return RESERVED[platform].find((entry) => entry.key === sequence.canonical);
}

export function isReservedShortcut(sequence: KeySequence, platform: Platform): boolean {
  return Boolean(findReservedShortcut(sequence, platform));
}
