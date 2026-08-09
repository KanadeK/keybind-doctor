import type { ContextOverlap } from './types';

type Token =
  | { kind: 'word'; value: string }
  | { kind: 'operator'; value: string }
  | { kind: 'left' }
  | { kind: 'right' };

type ContextNode =
  | { kind: 'atom'; key: string; operator: 'truthy' | '==' | '!='; value: string }
  | { kind: 'and'; left: ContextNode; right: ContextNode }
  | { kind: 'or'; left: ContextNode; right: ContextNode }
  | { kind: 'not'; child: ContextNode }
  | { kind: 'unknown' };

interface Constraint {
  equals?: string;
  notEquals: Set<string>;
}

type Clause = Map<string, Constraint>;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /\s*(&&|\|\||==|!=|=~|!~|\(|\)|!|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\/(?:\\.|[^/])+\/[a-z]*|[^\s()!&|=~]+)/gy;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    const value = match[1];
    if (value === '(') tokens.push({ kind: 'left' });
    else if (value === ')') tokens.push({ kind: 'right' });
    else if (['&&', '||', '==', '!=', '=~', '!~', '!'].includes(value)) {
      tokens.push({ kind: 'operator', value });
    } else {
      tokens.push({ kind: 'word', value });
    }
  }
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ContextNode {
    if (this.tokens.length === 0) return { kind: 'atom', key: '__always', operator: 'truthy', value: 'true' };
    const node = this.parseOr();
    return this.index === this.tokens.length ? node : { kind: 'unknown' };
  }

  private parseOr(): ContextNode {
    let node = this.parseAnd();
    while (this.peekOperator('||')) {
      this.index += 1;
      node = { kind: 'or', left: node, right: this.parseAnd() };
    }
    return node;
  }

  private parseAnd(): ContextNode {
    let node = this.parseUnary();
    while (this.peekOperator('&&')) {
      this.index += 1;
      node = { kind: 'and', left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): ContextNode {
    if (this.peekOperator('!')) {
      this.index += 1;
      return { kind: 'not', child: this.parseUnary() };
    }
    const token = this.tokens[this.index];
    if (!token) return { kind: 'unknown' };
    if (token.kind === 'left') {
      this.index += 1;
      const node = this.parseOr();
      if (this.tokens[this.index]?.kind !== 'right') return { kind: 'unknown' };
      this.index += 1;
      return node;
    }
    if (token.kind !== 'word') return { kind: 'unknown' };
    this.index += 1;
    const operator = this.tokens[this.index];
    if (operator?.kind === 'operator' && ['==', '!='].includes(operator.value)) {
      this.index += 1;
      const value = this.tokens[this.index];
      if (value?.kind !== 'word') return { kind: 'unknown' };
      this.index += 1;
      return {
        kind: 'atom',
        key: token.value,
        operator: operator.value as '==' | '!=',
        value: stripQuotes(value.value),
      };
    }
    if (operator?.kind === 'operator' && ['=~', '!~'].includes(operator.value)) {
      return { kind: 'unknown' };
    }
    return { kind: 'atom', key: token.value, operator: 'truthy', value: 'true' };
  }

  private peekOperator(value: string): boolean {
    const token = this.tokens[this.index];
    return token?.kind === 'operator' && token.value === value;
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function negate(node: ContextNode): ContextNode {
  if (node.kind === 'atom') {
    if (node.operator === 'truthy') {
      return { ...node, value: node.value === 'true' ? 'false' : 'true' };
    }
    return { ...node, operator: node.operator === '==' ? '!=' : '==' };
  }
  if (node.kind === 'not') return node.child;
  if (node.kind === 'and') {
    return { kind: 'or', left: negate(node.left), right: negate(node.right) };
  }
  if (node.kind === 'or') {
    return { kind: 'and', left: negate(node.left), right: negate(node.right) };
  }
  return { kind: 'unknown' };
}

function mergeClauses(left: Clause, right: Clause): Clause | null {
  const result: Clause = new Map();
  for (const [key, constraint] of [...left, ...right]) {
    const existing = result.get(key) ?? { notEquals: new Set<string>() };
    if (constraint.equals !== undefined) {
      if (existing.equals !== undefined && existing.equals !== constraint.equals) return null;
      if (existing.notEquals.has(constraint.equals)) return null;
      existing.equals = constraint.equals;
    }
    for (const value of constraint.notEquals) {
      if (existing.equals === value) return null;
      existing.notEquals.add(value);
    }
    result.set(key, existing);
  }
  return result;
}

function toDnf(node: ContextNode): Clause[] | null {
  if (node.kind === 'unknown') return null;
  if (node.kind === 'not') return toDnf(negate(node.child));
  if (node.kind === 'atom') {
    const constraint: Constraint = { notEquals: new Set<string>() };
    if (node.operator === '!=' ) constraint.notEquals.add(node.value);
    else constraint.equals = node.value;
    return [new Map([[node.key, constraint]])];
  }
  const left = toDnf(node.left);
  const right = toDnf(node.right);
  if (!left || !right) return null;
  if (node.kind === 'or') return [...left, ...right];
  const merged: Clause[] = [];
  for (const leftClause of left) {
    for (const rightClause of right) {
      const clause = mergeClauses(leftClause, rightClause);
      if (clause) merged.push(clause);
    }
  }
  return merged;
}

function parseContext(value?: string): Clause[] | null {
  if (!value?.trim()) return [new Map()];
  try {
    return toDnf(new Parser(tokenize(value)).parse());
  } catch {
    return null;
  }
}

export function contextsOverlap(left?: string, right?: string): ContextOverlap {
  const leftDnf = parseContext(left);
  const rightDnf = parseContext(right);
  if (!leftDnf || !rightDnf) return 'unknown';
  for (const leftClause of leftDnf) {
    for (const rightClause of rightDnf) {
      if (mergeClauses(leftClause, rightClause)) return 'overlap';
    }
  }
  return 'disjoint';
}
