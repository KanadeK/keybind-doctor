export function stableId(...parts: string[]): string {
  let hash = 2166136261;
  const value = parts.join('\u241f');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function lineOf(content: string, needle: string, startAt = 0): number | undefined {
  const index = content.indexOf(needle, startAt);
  if (index < 0) return undefined;
  return content.slice(0, index).split(/\r?\n/).length;
}

export function stringifyCommand(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (value === null) return 'disabled';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' });
}

export function canonicalApplicationName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\.exe$/, '');
  const aliases: Record<string, string> = {
    code: 'visual studio code',
    'visual studio code': 'visual studio code',
    cursor: 'cursor',
    windsurf: 'windsurf',
    zed: 'zed',
    idea64: 'intellij idea',
    idea: 'intellij idea',
    'intellij idea': 'intellij idea',
    webstorm64: 'webstorm',
    webstorm: 'webstorm',
    pycharm64: 'pycharm',
    pycharm: 'pycharm',
  };
  return aliases[normalized] ?? normalized;
}
