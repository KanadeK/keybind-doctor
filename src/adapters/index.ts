import { XMLParser } from 'fast-xml-parser';
import {
  parse as parseJsonc,
  printParseErrorCode,
  type ParseError,
} from 'jsonc-parser';
import { z } from 'zod';
import {
  parseAutoHotkeySequence,
  parseJetBrainsSequence,
  parseKeySequence,
  parsePowerToysKeys,
} from '../core/key';
import type {
  Binding,
  BindingScope,
  InputFile,
  InputFormat,
  KeySequence,
  ParseResult,
  SourceFormat,
} from '../core/types';
import { lineOf, stableId, stringifyCommand } from '../core/utils';

interface RawBinding {
  application: string;
  command: string;
  sequence: KeySequence;
  scope: BindingScope;
  context?: string;
  enabled?: boolean;
  locked?: boolean;
  line?: number;
  metadata?: Record<string, unknown>;
}

function makeBinding(file: InputFile, format: SourceFormat, raw: RawBinding): Binding {
  return {
    id: `b_${stableId(
      file.name,
      format,
      raw.application,
      raw.command,
      raw.sequence.canonical,
      String(raw.line ?? 0),
    )}`,
    source: format,
    application: raw.application,
    command: raw.command,
    sequence: raw.sequence,
    scope: raw.scope,
    context: raw.context?.trim() || undefined,
    enabled: raw.enabled ?? true,
    locked: raw.locked ?? false,
    location: {
      file: file.name,
      line: raw.line,
    },
    metadata: raw.metadata,
  };
}

function inferApplication(file: InputFile, fallback: string): string {
  if (file.application?.trim()) return file.application.trim();
  const name = file.name.toLowerCase();
  if (name.includes('cursor')) return 'Cursor';
  if (name.includes('windsurf')) return 'Windsurf';
  if (name.includes('vscode') || name.includes('code-keybindings')) return 'Visual Studio Code';
  if (name.includes('zed')) return 'Zed';
  if (name.includes('idea') || name.includes('intellij')) return 'IntelliJ IDEA';
  if (name.includes('webstorm')) return 'WebStorm';
  if (name.includes('pycharm')) return 'PyCharm';
  return fallback;
}

function parseJsonContent(file: InputFile): { value: unknown; warnings: string[] } {
  const errors: ParseError[] = [];
  const value = parseJsonc(file.content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });
  const warnings = errors.map((error) => {
    const line = file.content.slice(0, error.offset).split(/\r?\n/).length;
    return `${file.name}:${line}: JSONC ${printParseErrorCode(error.error)}`;
  });
  return { value, warnings };
}

function parseVsCode(file: InputFile): ParseResult {
  const application = inferApplication(file, 'Visual Studio Code');
  const { value, warnings } = parseJsonContent(file);
  if (!Array.isArray(value)) {
    throw new Error(`${file.name}: expected a JSON array of VS Code keyboard rules.`);
  }
  const bindings: Binding[] = [];
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`${file.name}: entry ${index + 1} is not an object and was skipped.`);
      continue;
    }
    const rule = entry as Record<string, unknown>;
    if (typeof rule.key !== 'string' || typeof rule.command !== 'string') {
      warnings.push(`${file.name}: entry ${index + 1} has no string key/command and was skipped.`);
      continue;
    }
    try {
      const declaredContext = typeof rule.when === 'string' ? rule.when : undefined;
      const systemWide = rule.systemWide === true;
      const context = systemWide ? undefined : declaredContext;
      bindings.push(
        makeBinding(file, 'vscode', {
          application,
          command: rule.command.replace(/^-/, ''),
          sequence: parseKeySequence(rule.key),
          scope: systemWide ? 'global' : context ? 'context' : 'application',
          context,
          enabled: !rule.command.startsWith('-') && rule.command.length > 0,
          line: lineOf(file.content, JSON.stringify(rule.key)),
          metadata: {
            systemWide,
            declaredContext,
            order: index,
          },
        }),
      );
    } catch (error) {
      warnings.push(`${file.name}: entry ${index + 1}: ${errorMessage(error)}`);
    }
  }
  return { format: 'vscode', application, bindings, warnings };
}

function parseZed(file: InputFile): ParseResult {
  const application = inferApplication(file, 'Zed');
  const { value, warnings } = parseJsonContent(file);
  if (!Array.isArray(value)) {
    throw new Error(`${file.name}: expected a JSON array of Zed binding groups.`);
  }
  const bindings: Binding[] = [];
  for (const [groupIndex, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') continue;
    const group = entry as Record<string, unknown>;
    const context = typeof group.context === 'string' ? group.context : undefined;
    if (!group.bindings || typeof group.bindings !== 'object' || Array.isArray(group.bindings)) {
      warnings.push(`${file.name}: Zed group ${groupIndex + 1} has no bindings object.`);
      continue;
    }
    for (const [key, action] of Object.entries(group.bindings as Record<string, unknown>)) {
      try {
        bindings.push(
          makeBinding(file, 'zed', {
            application,
            command: stringifyCommand(action),
            sequence: parseKeySequence(key.replace(/-/g, '+')),
            scope: context ? 'context' : 'application',
            context,
            enabled: action !== null,
            line: lineOf(file.content, JSON.stringify(key)),
            metadata: { group: groupIndex },
          }),
        );
      } catch (error) {
        warnings.push(`${file.name}: Zed binding "${key}": ${errorMessage(error)}`);
      }
    }
  }
  return { format: 'zed', application, bindings, warnings };
}

interface XmlShortcut {
  'first-keystroke'?: string;
  'second-keystroke'?: string;
}

interface XmlAction {
  id?: string;
  'keyboard-shortcut'?: XmlShortcut | XmlShortcut[];
}

function parseJetBrains(file: InputFile): ParseResult {
  const application = inferApplication(file, 'JetBrains IDE');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
  });
  const document = parser.parse(file.content) as {
    keymap?: { action?: XmlAction | XmlAction[]; name?: string };
  };
  if (!document.keymap) {
    throw new Error(`${file.name}: expected a JetBrains <keymap> document.`);
  }
  const warnings: string[] = [];
  const bindings: Binding[] = [];
  const actions = toArray(document.keymap.action);
  for (const action of actions) {
    const command = action.id ?? 'unknown-action';
    for (const shortcut of toArray(action['keyboard-shortcut'])) {
      if (!shortcut?.['first-keystroke']) continue;
      try {
        bindings.push(
          makeBinding(file, 'jetbrains', {
            application,
            command,
            sequence: parseJetBrainsSequence(
              shortcut['first-keystroke'],
              shortcut['second-keystroke'],
            ),
            scope: 'application',
            line: lineOf(file.content, shortcut['first-keystroke']),
            metadata: { keymap: document.keymap.name },
          }),
        );
      } catch (error) {
        warnings.push(`${file.name}: action ${command}: ${errorMessage(error)}`);
      }
    }
  }
  return { format: 'jetbrains', application, bindings, warnings };
}

interface PowerToysShortcut {
  originalKeys?: string;
  secondKeyOfChord?: number;
  newRemapKeys?: string;
  newKeys?: string;
  targetApp?: string;
  operationType?: number;
}

function parsePowerToys(file: InputFile): ParseResult {
  const application = inferApplication(file, 'PowerToys Keyboard Manager');
  const { value, warnings } = parseJsonContent(file);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file.name}: expected a PowerToys Keyboard Manager profile object.`);
  }
  const root = value as Record<string, unknown>;
  const shortcutRoot =
    root.remapShortcuts && typeof root.remapShortcuts === 'object'
      ? (root.remapShortcuts as Record<string, unknown>)
      : undefined;
  if (!shortcutRoot) {
    throw new Error(`${file.name}: no remapShortcuts section was found.`);
  }
  const bindings: Binding[] = [];
  const addEntries = (entries: unknown, appSpecific: boolean) => {
    for (const [index, item] of toArray(entries).entries()) {
      if (!item || typeof item !== 'object') continue;
      const shortcut = item as PowerToysShortcut;
      if (!shortcut.originalKeys) {
        warnings.push(`${file.name}: PowerToys shortcut ${index + 1} has no originalKeys.`);
        continue;
      }
      try {
        const targetApplication =
          appSpecific && shortcut.targetApp?.trim() ? shortcut.targetApp.trim() : application;
        const remapTarget = shortcut.newRemapKeys ?? shortcut.newKeys ?? 'operation';
        bindings.push(
          makeBinding(file, 'powertoys', {
            application: targetApplication,
            command: `remap to ${remapTarget}`,
            sequence: parsePowerToysKeys(shortcut.originalKeys, shortcut.secondKeyOfChord),
            scope: appSpecific ? 'application' : 'global',
            line: lineOf(file.content, shortcut.originalKeys),
            metadata: {
              operationType: shortcut.operationType,
              targetApp: shortcut.targetApp,
            },
          }),
        );
      } catch (error) {
        warnings.push(`${file.name}: PowerToys shortcut ${index + 1}: ${errorMessage(error)}`);
      }
    }
  };
  addEntries(shortcutRoot.global, false);
  addEntries(shortcutRoot.appSpecific, true);
  return { format: 'powertoys', application, bindings, warnings };
}

function parseAutoHotkey(file: InputFile): ParseResult {
  const application = inferApplication(file, 'AutoHotkey');
  const warnings: string[] = [];
  const bindings: Binding[] = [];
  let context: string | undefined;
  const lines = file.content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) return;
    const hotIf = line.match(/^#HotIf(?:\s+(.*))?$/i);
    if (hotIf) {
      context = hotIf[1]?.trim() || undefined;
      return;
    }
    const ifWin = line.match(/^#IfWin(?:Active|Exist)?(?:\s*,?\s*(.*))?$/i);
    if (ifWin) {
      context = ifWin[1]?.trim() ? `WinActive(${ifWin[1].trim()})` : undefined;
      return;
    }

    const directive = line.match(/^Hotkey\s+["']([^"']+)["']\s*,\s*(.+)$/i);
    const declaration = line.match(/^([^:\s][^:]*)::(.*)$/);
    const shortcut = directive?.[1] ?? declaration?.[1];
    const command = directive?.[2] ?? declaration?.[2];
    if (!shortcut) return;
    if (shortcut.includes('&')) {
      warnings.push(
        `${file.name}:${index + 1}: custom combination "${shortcut}" is not supported yet.`,
      );
      return;
    }
    try {
      bindings.push(
        makeBinding(file, 'autohotkey', {
          application,
          command: command?.trim() || `script action at line ${index + 1}`,
          sequence: parseAutoHotkeySequence(shortcut.replace(/\s+up$/i, '')),
          scope: 'global',
          context,
          line: index + 1,
        }),
      );
    } catch (error) {
      warnings.push(`${file.name}:${index + 1}: ${errorMessage(error)}`);
    }
  });

  return { format: 'autohotkey', application, bindings, warnings };
}

const manifestSchema = z.object({
  version: z.literal(1),
  application: z.string().min(1),
  bindings: z.array(
    z.object({
      key: z.string().min(1),
      command: z.string().min(1),
      scope: z.enum(['global', 'application', 'context']).default('application'),
      context: z.string().optional(),
      enabled: z.boolean().default(true),
      locked: z.boolean().default(false),
    }),
  ),
});

function parseManifest(file: InputFile): ParseResult {
  const { value, warnings } = parseJsonContent(file);
  const manifest = manifestSchema.parse(value);
  const application = file.application?.trim() || manifest.application;
  const bindings = manifest.bindings.map((entry, index) =>
    makeBinding(file, 'manifest', {
      application,
      command: entry.command,
      sequence: parseKeySequence(entry.key),
      scope: entry.scope,
      context: entry.context,
      enabled: entry.enabled,
      locked: entry.locked,
      line: lineOf(file.content, JSON.stringify(entry.key)),
      metadata: { order: index },
    }),
  );
  return { format: 'manifest', application, bindings, warnings };
}

function detectFormat(file: InputFile): SourceFormat {
  const explicit = file.format ?? 'auto';
  if (explicit !== 'auto') return explicit;
  const name = file.name.toLowerCase();
  const trimmed = file.content.trim();
  if (name.endsWith('.ahk')) return 'autohotkey';
  if (name.endsWith('.xml') || trimmed.startsWith('<keymap')) return 'jetbrains';

  const { value } = parseJsonContent(file);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    if ('remapShortcuts' in object || name.includes('powertoys')) return 'powertoys';
    if (object.version === 1 && Array.isArray(object.bindings)) return 'manifest';
  }
  if (Array.isArray(value)) {
    if (
      value.some(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          'bindings' in (entry as Record<string, unknown>),
      ) ||
      name.includes('zed') ||
      name === 'keymap.json'
    ) {
      return 'zed';
    }
    return 'vscode';
  }
  throw new Error(
    `${file.name}: format could not be detected. Pass an explicit --input-format option or use the manifest schema.`,
  );
}

export function parseInput(file: InputFile): ParseResult {
  const format: InputFormat = detectFormat(file);
  switch (format) {
    case 'vscode':
      return parseVsCode(file);
    case 'zed':
      return parseZed(file);
    case 'jetbrains':
      return parseJetBrains(file);
    case 'powertoys':
      return parsePowerToys(file);
    case 'autohotkey':
      return parseAutoHotkey(file);
    case 'manifest':
      return parseManifest(file);
    default:
      throw new Error(`${file.name}: unsupported format ${String(format)}.`);
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
