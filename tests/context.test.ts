import { describe, expect, it } from 'vitest';
import { contextsOverlap } from '../src/core/context';

describe('bounded context overlap solver', () => {
  it('proves complementary booleans disjoint', () => {
    expect(contextsOverlap('debuggersAvailable && !inDebugMode', 'inDebugMode')).toBe(
      'disjoint',
    );
  });

  it('proves incompatible equality constraints disjoint', () => {
    expect(
      contextsOverlap('editorLangId == typescript', 'editorLangId == python'),
    ).toBe('disjoint');
  });

  it('finds a satisfiable branch in disjunctions', () => {
    expect(contextsOverlap('isLinux || isWindows', 'isWindows && editorFocus')).toBe(
      'overlap',
    );
  });

  it('returns unknown for regex and function syntax', () => {
    expect(contextsOverlap('resourceScheme =~ /file/', 'resourceScheme == file')).toBe(
      'unknown',
    );
    expect(contextsOverlap('WinActive("code.exe")', undefined)).toBe('unknown');
  });
});
