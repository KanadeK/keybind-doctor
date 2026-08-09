export const TOOL_VERSION = '0.1.0';

export type Platform = 'windows' | 'macos' | 'linux';

export type InputFormat =
  | 'auto'
  | 'vscode'
  | 'zed'
  | 'jetbrains'
  | 'powertoys'
  | 'autohotkey'
  | 'manifest';

export type SourceFormat = Exclude<InputFormat, 'auto'>;

export type BindingScope = 'global' | 'application' | 'context';

export type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyStroke {
  modifiers: Modifier[];
  key: string;
}

export interface KeySequence {
  canonical: string;
  display: string;
  strokes: KeyStroke[];
}

export interface SourceLocation {
  file: string;
  line?: number;
}

export interface Binding {
  id: string;
  source: SourceFormat;
  application: string;
  command: string;
  sequence: KeySequence;
  scope: BindingScope;
  context?: string;
  enabled: boolean;
  locked: boolean;
  location: SourceLocation;
  metadata?: Record<string, unknown>;
}

export type ConflictKind = 'definite' | 'shadow' | 'potential' | 'reserved';

export type Severity = 'high' | 'medium' | 'low';

export interface Conflict {
  id: string;
  kind: ConflictKind;
  severity: Severity;
  key: string;
  bindingIds: string[];
  title: string;
  explanation: string;
}

export interface SafeReuse {
  key: string;
  bindingIds: string[];
  reason: string;
}

export interface RepairSuggestion {
  bindingId: string;
  from: string;
  to: string;
  cost: number;
  reason: string;
  resolvesConflictIds: string[];
}

export interface UnresolvedRepair {
  conflictId: string;
  reason: string;
}

export interface AnalysisSummary {
  files: number;
  bindings: number;
  definite: number;
  shadow: number;
  potential: number;
  reserved: number;
  safeReuses: number;
  suggestions: number;
  unresolved: number;
}

export interface AnalysisResult {
  schemaVersion: 1;
  toolVersion: string;
  generatedAt: string;
  platform: Platform;
  bindings: Binding[];
  conflicts: Conflict[];
  safeReuses: SafeReuse[];
  suggestions: RepairSuggestion[];
  unresolved: UnresolvedRepair[];
  warnings: string[];
  summary: AnalysisSummary;
}

export interface InputFile {
  name: string;
  content: string;
  format?: InputFormat;
  application?: string;
}

export interface ParseResult {
  format: SourceFormat;
  application: string;
  bindings: Binding[];
  warnings: string[];
}

export interface AnalyzeOptions {
  platform?: Platform;
  now?: Date;
  includePlan?: boolean;
}

export type ContextOverlap = 'overlap' | 'disjoint' | 'unknown';
