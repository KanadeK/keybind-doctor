import { parseInput } from '../adapters';
import { contextsOverlap } from './context';
import { isSequencePrefix } from './key';
import { findReservedShortcut } from './reserved';
import { buildRepairPlan } from './solver';
import type {
  AnalysisResult,
  AnalyzeOptions,
  Binding,
  Conflict,
  ConflictKind,
  InputFile,
  Platform,
  SafeReuse,
  Severity,
} from './types';
import { TOOL_VERSION } from './types';
import { canonicalApplicationName, naturalCompare, stableId } from './utils';

interface PairAssessment {
  relation: 'conflict' | 'safe' | 'none';
  kind?: ConflictKind;
  severity?: Severity;
  title?: string;
  explanation?: string;
  safeReason?: string;
}

function applicationMatches(left: Binding, right: Binding): boolean {
  return (
    canonicalApplicationName(left.application) === canonicalApplicationName(right.application)
  );
}

function assessEnvironment(left: Binding, right: Binding): {
  overlaps: 'yes' | 'no' | 'unknown';
  mixedGlobal: boolean;
  safeReason?: string;
} {
  const leftGlobal = left.scope === 'global';
  const rightGlobal = right.scope === 'global';
  const mixedGlobal = leftGlobal !== rightGlobal;

  if (!leftGlobal && !rightGlobal && !applicationMatches(left, right)) {
    return {
      overlaps: 'no',
      mixedGlobal,
      safeReason: `Application-scoped in ${left.application} and ${right.application}.`,
    };
  }

  const context = contextsOverlap(left.context, right.context);
  if (context === 'disjoint') {
    return {
      overlaps: 'no',
      mixedGlobal,
      safeReason: 'The context expressions are mutually exclusive.',
    };
  }
  if (context === 'unknown') return { overlaps: 'unknown', mixedGlobal };
  return { overlaps: 'yes', mixedGlobal };
}

function assessPair(left: Binding, right: Binding): PairAssessment {
  if (!left.enabled || !right.enabled) return { relation: 'none' };
  const exact = left.sequence.canonical === right.sequence.canonical;
  const prefix =
    isSequencePrefix(left.sequence, right.sequence) ||
    isSequencePrefix(right.sequence, left.sequence);
  if (!exact && !prefix) return { relation: 'none' };

  const environment = assessEnvironment(left, right);
  if (environment.overlaps === 'no') {
    return exact
      ? {
          relation: 'safe',
          safeReason: environment.safeReason,
        }
      : { relation: 'none' };
  }

  if (prefix) {
    return {
      relation: 'conflict',
      kind: 'potential',
      severity: 'medium',
      title: 'Chord prefix can consume a longer shortcut',
      explanation:
        'One shortcut starts with the complete sequence of another in an overlapping scope. Dispatch order or timeout behavior can make the longer chord unreachable.',
    };
  }

  if (
    left.command === right.command &&
    left.application === right.application &&
    left.context === right.context
  ) {
    return { relation: 'none' };
  }

  if (environment.overlaps === 'unknown') {
    return {
      relation: 'conflict',
      kind: 'potential',
      severity: 'medium',
      title: 'Context overlap needs review',
      explanation:
        'The shortcut is reused in scopes whose context expressions include syntax the bounded solver cannot prove disjoint.',
    };
  }

  if (environment.mixedGlobal) {
    return {
      relation: 'conflict',
      kind: 'shadow',
      severity: 'high',
      title: 'Global shortcut shadows an application shortcut',
      explanation:
        'A system-wide handler can capture this key before the focused application receives it.',
    };
  }

  return {
    relation: 'conflict',
    kind: 'definite',
    severity: 'high',
    title: 'Two commands compete for the same shortcut',
    explanation:
      'Both bindings can be active in the same application or global scope, so dispatch order decides which command wins.',
  };
}

export function bindingsCouldConflict(left: Binding, right: Binding): boolean {
  const pair = assessPair(left, right);
  return pair.relation === 'conflict';
}

function pairConflict(left: Binding, right: Binding, assessment: PairAssessment): Conflict {
  const ids = [left.id, right.id].sort(naturalCompare);
  const kind = assessment.kind ?? 'potential';
  return {
    id: `c_${stableId(kind, left.sequence.canonical, ...ids)}`,
    kind,
    severity: assessment.severity ?? 'medium',
    key: left.sequence.canonical,
    bindingIds: ids,
    title: assessment.title ?? 'Shortcut conflict',
    explanation: assessment.explanation ?? 'These bindings may be active at the same time.',
  };
}

function currentPlatform(): Platform {
  if (typeof navigator !== 'undefined') {
    const value = navigator.platform.toLowerCase();
    if (value.includes('mac')) return 'macos';
    if (value.includes('linux')) return 'linux';
  }
  return 'windows';
}

export function analyzeInputs(
  files: InputFile[],
  options: AnalyzeOptions = {},
): AnalysisResult {
  if (files.length === 0) {
    throw new Error('At least one keybinding file is required.');
  }
  const platform = options.platform ?? currentPlatform();
  const bindings: Binding[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    const parsed = parseInput(file);
    bindings.push(...parsed.bindings);
    warnings.push(...parsed.warnings);
  }

  const activeBindings = bindings
    .filter((binding) => binding.enabled)
    .sort((left, right) => {
      return (
        naturalCompare(left.sequence.canonical, right.sequence.canonical) ||
        naturalCompare(left.application, right.application) ||
        naturalCompare(left.id, right.id)
      );
    });

  const conflicts: Conflict[] = [];
  const safeReuses: SafeReuse[] = [];
  for (const binding of activeBindings) {
    const reserved = findReservedShortcut(binding.sequence, platform);
    if (reserved) {
      conflicts.push({
        id: `c_${stableId('reserved', platform, binding.id)}`,
        kind: 'reserved',
        severity: reserved.hard ? 'high' : 'medium',
        key: binding.sequence.canonical,
        bindingIds: [binding.id],
        title: reserved.hard ? 'Operating system shortcut is reserved' : 'Common system shortcut is reused',
        explanation: `${reserved.label}. Registration may fail or the operating system action may win.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < activeBindings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < activeBindings.length; rightIndex += 1) {
      const left = activeBindings[leftIndex];
      const right = activeBindings[rightIndex];
      const assessment = assessPair(left, right);
      if (assessment.relation === 'conflict') {
        conflicts.push(pairConflict(left, right, assessment));
      } else if (assessment.relation === 'safe') {
        safeReuses.push({
          key: left.sequence.canonical,
          bindingIds: [left.id, right.id].sort(naturalCompare),
          reason: assessment.safeReason ?? 'The scopes do not overlap.',
        });
      }
    }
  }

  conflicts.sort((left, right) => {
    const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    return (
      severityRank[left.severity] - severityRank[right.severity] ||
      naturalCompare(left.key, right.key) ||
      naturalCompare(left.id, right.id)
    );
  });
  safeReuses.sort(
    (left, right) => naturalCompare(left.key, right.key) || naturalCompare(left.bindingIds[0], right.bindingIds[0]),
  );

  const plan =
    options.includePlan === false
      ? { suggestions: [], unresolved: [] }
      : buildRepairPlan(activeBindings, conflicts, platform);

  return {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    platform,
    bindings,
    conflicts,
    safeReuses,
    suggestions: plan.suggestions,
    unresolved: plan.unresolved,
    warnings,
    summary: {
      files: files.length,
      bindings: activeBindings.length,
      definite: conflicts.filter((conflict) => conflict.kind === 'definite').length,
      shadow: conflicts.filter((conflict) => conflict.kind === 'shadow').length,
      potential: conflicts.filter((conflict) => conflict.kind === 'potential').length,
      reserved: conflicts.filter((conflict) => conflict.kind === 'reserved').length,
      safeReuses: safeReuses.length,
      suggestions: plan.suggestions.length,
      unresolved: plan.unresolved.length,
    },
  };
}
