import { contextsOverlap } from './context';
import { isSequencePrefix, replaceLastStroke, replaceStroke } from './key';
import { isReservedShortcut } from './reserved';
import type {
  Binding,
  Conflict,
  KeySequence,
  Modifier,
  Platform,
  RepairSuggestion,
  UnresolvedRepair,
} from './types';
import { canonicalApplicationName, naturalCompare } from './utils';

interface Candidate {
  sequence: KeySequence;
  cost: number;
}

interface RepairPlan {
  suggestions: RepairSuggestion[];
  unresolved: UnresolvedRepair[];
}

const MODIFIERS: Modifier[] = ['ctrl', 'alt', 'shift', 'meta'];
const FALLBACK_KEYS = [
  ...Array.from({ length: 12 }, (_, index) => `f${index + 1}`),
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
  '[',
  ']',
  ';',
  ',',
  '.',
  '/',
];

function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = best.get(candidate.sequence.canonical);
    if (!existing || candidate.cost < existing.cost) {
      best.set(candidate.sequence.canonical, candidate);
    }
  }
  return [...best.values()].sort(
    (left, right) =>
      left.cost - right.cost || naturalCompare(left.sequence.canonical, right.sequence.canonical),
  );
}

function candidatesFor(binding: Binding): Candidate[] {
  const last = binding.sequence.strokes[binding.sequence.strokes.length - 1];
  const candidates: Candidate[] = [];

  for (const modifier of MODIFIERS) {
    if (!last.modifiers.includes(modifier)) {
      candidates.push({
        sequence: replaceLastStroke(binding.sequence, [...last.modifiers, modifier], last.key),
        cost: 1,
      });
    }
  }
  for (const modifier of last.modifiers) {
    candidates.push({
      sequence: replaceLastStroke(
        binding.sequence,
        last.modifiers.filter((item) => item !== modifier),
        last.key,
      ),
      cost: 2,
    });
  }
  for (const remove of last.modifiers) {
    for (const add of MODIFIERS) {
      if (last.modifiers.includes(add)) continue;
      candidates.push({
        sequence: replaceLastStroke(
          binding.sequence,
          [...last.modifiers.filter((item) => item !== remove), add],
          last.key,
        ),
        cost: 2,
      });
    }
  }
  for (const key of FALLBACK_KEYS) {
    if (key === last.key) continue;
    candidates.push({
      sequence: replaceLastStroke(binding.sequence, last.modifiers, key),
      cost: key.startsWith('f') ? 3 : 4,
    });
  }
  for (const key of FALLBACK_KEYS) {
    if (key === last.key) continue;
    for (const modifier of MODIFIERS) {
      if (last.modifiers.includes(modifier)) continue;
      candidates.push({
        sequence: replaceLastStroke(binding.sequence, [...last.modifiers, modifier], key),
        cost: 5,
      });
    }
  }
  if (binding.sequence.strokes.length > 1) {
    const first = binding.sequence.strokes[0];
    for (const modifier of MODIFIERS) {
      if (first.modifiers.includes(modifier)) continue;
      candidates.push({
        sequence: replaceStroke(
          binding.sequence,
          0,
          [...first.modifiers, modifier],
          first.key,
        ),
        cost: 2,
      });
    }
    for (const key of FALLBACK_KEYS) {
      if (key === first.key) continue;
      candidates.push({
        sequence: replaceStroke(binding.sequence, 0, first.modifiers, key),
        cost: 4,
      });
    }
  }
  return uniqueCandidates(candidates);
}

function environmentCanOverlap(left: Binding, right: Binding): boolean {
  const leftGlobal = left.scope === 'global';
  const rightGlobal = right.scope === 'global';
  if (
    !leftGlobal &&
    !rightGlobal &&
    canonicalApplicationName(left.application) !== canonicalApplicationName(right.application)
  ) {
    return false;
  }
  return contextsOverlap(left.context, right.context) !== 'disjoint';
}

function sequenceCollides(left: Binding, right: Binding): boolean {
  if (!environmentCanOverlap(left, right)) return false;
  return (
    left.sequence.canonical === right.sequence.canonical ||
    isSequencePrefix(left.sequence, right.sequence) ||
    isSequencePrefix(right.sequence, left.sequence)
  );
}

function movableBinding(
  conflict: Conflict,
  bindingsById: Map<string, Binding>,
  conflictCounts: Map<string, number>,
): Binding | undefined {
  const scopeRank = { context: 0, application: 1, global: 2 };
  return conflict.bindingIds
    .map((id) => bindingsById.get(id))
    .filter((binding): binding is Binding => binding !== undefined && !binding.locked)
    .sort((left, right) => {
      return (
        scopeRank[left.scope] - scopeRank[right.scope] ||
        (conflictCounts.get(right.id) ?? 0) - (conflictCounts.get(left.id) ?? 0) ||
        naturalCompare(left.id, right.id)
      );
    })[0];
}

export function buildRepairPlan(
  bindings: Binding[],
  conflicts: Conflict[],
  platform: Platform,
): RepairPlan {
  const bindingsById = new Map(bindings.map((binding) => [binding.id, binding]));
  const conflictCounts = new Map<string, number>();
  for (const conflict of conflicts) {
    for (const id of conflict.bindingIds) {
      conflictCounts.set(id, (conflictCounts.get(id) ?? 0) + 1);
    }
  }

  const suggestionsByBinding = new Map<string, RepairSuggestion>();
  const unresolved: UnresolvedRepair[] = [];
  const processed = new Set<string>();

  for (const conflict of conflicts) {
    if (processed.has(conflict.id)) continue;
    const existingSuggestion = conflict.bindingIds
      .map((id) => suggestionsByBinding.get(id))
      .find(Boolean);
    if (existingSuggestion) {
      existingSuggestion.resolvesConflictIds.push(conflict.id);
      processed.add(conflict.id);
      continue;
    }

    const target = movableBinding(conflict, bindingsById, conflictCounts);
    if (!target) {
      unresolved.push({
        conflictId: conflict.id,
        reason: 'Every binding in this conflict is locked.',
      });
      processed.add(conflict.id);
      continue;
    }

    let selected: Candidate | undefined;
    for (const candidate of candidatesFor(target)) {
      if (isReservedShortcut(candidate.sequence, platform)) continue;
      const proposed: Binding = { ...target, sequence: candidate.sequence };
      const collides = bindings.some((other) => {
        if (other.id === target.id || !other.enabled) return false;
        const suggested = suggestionsByBinding.get(other.id);
        const effective = suggested
          ? { ...other, sequence: replaceSequence(other, suggested.to) }
          : other;
        return sequenceCollides(proposed, effective);
      });
      if (!collides) {
        selected = candidate;
        break;
      }
    }

    if (!selected) {
      unresolved.push({
        conflictId: conflict.id,
        reason: 'No collision-free candidate was found in the bounded search space.',
      });
      processed.add(conflict.id);
      continue;
    }

    const related = conflicts
      .filter((item) => item.bindingIds.includes(target.id))
      .map((item) => item.id)
      .filter((id) => !processed.has(id));
    const suggestion: RepairSuggestion = {
      bindingId: target.id,
      from: target.sequence.canonical,
      to: selected.sequence.canonical,
      cost: selected.cost,
      reason:
        target.scope === 'global'
          ? 'No narrower unlocked binding was available, so the global binding is moved.'
          : 'Moves the narrowest unlocked binding and preserves the command and context.',
      resolvesConflictIds: related,
    };
    suggestionsByBinding.set(target.id, suggestion);
    related.forEach((id) => processed.add(id));
  }

  return {
    suggestions: [...suggestionsByBinding.values()].sort(
      (left, right) => left.cost - right.cost || naturalCompare(left.bindingId, right.bindingId),
    ),
    unresolved: unresolved.sort((left, right) => naturalCompare(left.conflictId, right.conflictId)),
  };
}

function replaceSequence(binding: Binding, canonical: string): KeySequence {
  const parts = canonical.split(' ');
  const original = binding.sequence;
  if (parts.length !== original.strokes.length) return original;
  let sequence = original;
  parts.forEach((part, index) => {
    const items = part.split('+');
    const key = items.pop() ?? '';
    const modifiers = items.filter((item): item is Modifier =>
      MODIFIERS.includes(item as Modifier),
    );
    if (index === parts.length - 1) {
      sequence = replaceLastStroke(sequence, modifiers, key);
    }
  });
  return sequence;
}
