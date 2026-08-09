import {
  ArrowDown,
  ArrowSquareOut,
  Check,
  DownloadSimple,
  FileCode,
  Flask,
  GithubLogo,
  Moon,
  ShieldCheck,
  Sun,
  UploadSimple,
  Warning,
  X,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';
import vscodeSample from '../../examples/vscode-keybindings.json?raw';
import zedSample from '../../examples/zed-keymap.json?raw';
import jetBrainsSample from '../../examples/jetbrains-keymap.xml?raw';
import powerToysSample from '../../examples/powertoys-default.json?raw';
import autoHotkeySample from '../../examples/global-hotkeys.ahk?raw';
import { analyzeInputs } from '../core/analyze';
import { renderJsonReport, renderMarkdownReport } from '../core/report';
import type {
  AnalysisResult,
  Conflict,
  InputFile,
  Platform,
  RepairSuggestion,
} from '../core/types';

type Theme = 'dark' | 'light';
type View = 'findings' | 'repairs' | 'safe';

const SAMPLE_FILES: InputFile[] = [
  { name: 'vscode-keybindings.json', content: vscodeSample },
  { name: 'zed-keymap.json', content: zedSample },
  { name: 'jetbrains-keymap.xml', content: jetBrainsSample },
  { name: 'powertoys-default.json', content: powerToysSample },
  { name: 'global-hotkeys.ahk', content: autoHotkeySample },
];

function initialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [platform, setPlatform] = useState<Platform>('windows');
  const [files, setFiles] = useState<InputFile[]>(SAMPLE_FILES);
  const [selectedConflictId, setSelectedConflictId] = useState<string>();
  const [view, setView] = useState<View>('findings');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => {
    if (files.length === 0) return { result: undefined, error: undefined };
    try {
      return {
        result: analyzeInputs(files, { platform }),
        error: undefined,
      };
    } catch (error) {
      return {
        result: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [files, platform]);

  const result = analysis.result;
  const selectedConflict =
    result?.conflicts.find((conflict) => conflict.id === selectedConflictId) ??
    result?.conflicts[0];

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('keybind-doctor-theme', next);
  }

  async function addBrowserFiles(fileList: FileList | File[]) {
    const next = await Promise.all(
      Array.from(fileList).map(async (file): Promise<InputFile> => ({
        name: file.name,
        content: await file.text(),
      })),
    );
    setFiles((current) => {
      const byName = new Map(current.map((file) => [file.name, file]));
      next.forEach((file) => byName.set(file.name, file));
      return [...byName.values()];
    });
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name));
  }

  function loadSample() {
    setFiles(SAMPLE_FILES);
    setSelectedConflictId(undefined);
  }

  function downloadReport(format: 'json' | 'markdown') {
    if (!result) return;
    const content =
      format === 'json' ? renderJsonReport(result) : renderMarkdownReport(result);
    const extension = format === 'json' ? 'json' : 'md';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'keybind-doctor-report.' + extension;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Keybind Doctor home">
          <span className="brand-mark" aria-hidden="true">
            KD
          </span>
          <span>Keybind Doctor</span>
        </a>
        <nav className="header-actions" aria-label="Primary">
          <a
            className="icon-link"
            href="https://github.com/KanadeK/keybind-doctor"
            target="_blank"
            rel="noreferrer"
            aria-label="Open the GitHub repository"
            data-tooltip="GitHub"
          >
            <GithubLogo size={19} weight="bold" />
          </a>
          <button
            className="icon-link"
            type="button"
            onClick={toggleTheme}
            aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme'}
            data-tooltip={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun size={19} weight="bold" /> : <Moon size={19} weight="bold" />}
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              Local config diagnostics
            </div>
            <h1 id="hero-title">Shortcut conflicts, diagnosed.</h1>
            <p>
              Drop real configs. Get scope-aware conflicts and a minimum-change repair plan,
              entirely in your browser.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={loadSample}>
                <Flask size={18} weight="bold" />
                Run the example
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <UploadSimple size={18} weight="bold" />
                Choose configs
              </button>
            </div>
            <div className="trust-line">
              <ShieldCheck size={17} weight="fill" />
              <span>No server. No account. No config writes.</span>
            </div>
          </div>

          <div className="signal-panel" aria-label="Live example analysis">
            <div className="signal-header">
              <span>PORTFOLIO / WINDOWS</span>
              <span className="live-label">LIVE</span>
            </div>
            <div className="signal-key">CTRL + ALT + T</div>
            <div className="signal-lanes" aria-hidden="true">
              <SignalLane label="PowerToys" level="global" width="100%" />
              <SignalLane label="AutoHotkey" level="global" width="100%" />
              <SignalLane label="VS Code" level="app" width="72%" />
              <SignalLane label="Zed" level="app" width="58%" />
            </div>
            <div className="signal-verdict">
              <Warning size={18} weight="fill" />
              <div>
                <strong>Global capture detected</strong>
                <span>2 handlers can intercept 3 app bindings</span>
              </div>
            </div>
          </div>
        </section>

        <section className="workbench" aria-labelledby="workbench-title">
          <div className="section-heading">
            <div>
              <span className="section-index">01</span>
              <h2 id="workbench-title">Diagnostic workbench</h2>
            </div>
            <div className="platform-control" aria-label="Target platform">
              {(['windows', 'macos', 'linux'] as Platform[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={item === platform ? 'is-active' : ''}
                  onClick={() => setPlatform(item)}
                  aria-pressed={item === platform}
                >
                  {item === 'macos' ? 'macOS' : capitalize(item)}
                </button>
              ))}
            </div>
          </div>

          <div className="intake-grid">
            <div
              className={dragging ? 'drop-zone is-dragging' : 'drop-zone'}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addBrowserFiles(event.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".json,.jsonc,.xml,.ahk"
                onChange={(event) => {
                  if (event.target.files) void addBrowserFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <UploadSimple size={24} weight="bold" />
              <div>
                <strong>Drop configuration files</strong>
                <span>JSONC, XML, PowerToys JSON, or AHK</span>
              </div>
              <button type="button" onClick={() => inputRef.current?.click()}>
                Browse
              </button>
            </div>
            <div className="format-readout">
              <span className="readout-label">ADAPTERS ONLINE</span>
              <div className="adapter-list">
                {['VS Code', 'Zed', 'JetBrains', 'PowerToys', 'AutoHotkey'].map((name) => (
                  <span key={name}>
                    <Check size={13} weight="bold" />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="file-strip" aria-label="Loaded files">
            {files.length === 0 ? (
              <span className="empty-files">No files loaded. Use the example or add your own.</span>
            ) : (
              files.map((file) => (
                <span className="file-chip" key={file.name}>
                  <FileCode size={15} />
                  {file.name}
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    aria-label={'Remove ' + file.name}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </span>
              ))
            )}
          </div>

          {analysis.error ? (
            <div className="error-banner" role="alert">
              <Warning size={20} weight="fill" />
              <div>
                <strong>Input could not be parsed</strong>
                <span>{analysis.error}</span>
              </div>
            </div>
          ) : result ? (
            <Results
              result={result}
              view={view}
              setView={setView}
              selectedConflict={selectedConflict}
              onSelectConflict={setSelectedConflictId}
              onDownload={downloadReport}
            />
          ) : (
            <div className="empty-state">
              <ArrowDown size={22} />
              Add at least one configuration file to start the local analysis.
            </div>
          )}
        </section>

        <section className="method" aria-labelledby="method-title">
          <div className="section-heading">
            <div>
              <span className="section-index">02</span>
              <h2 id="method-title">Why the verdict is different</h2>
            </div>
          </div>
          <div className="method-grid">
            <article>
              <span>INPUT</span>
              <h3>Native config shapes</h3>
              <p>Line-level provenance survives parsing, including JSONC comments and IDE XML.</p>
            </article>
            <article>
              <span>REASONING</span>
              <h3>Scope before equality</h3>
              <p>Global capture, app boundaries, context clauses, and chord prefixes are evaluated separately.</p>
            </article>
            <article>
              <span>OUTPUT</span>
              <h3>Bounded repair search</h3>
              <p>Suggestions prefer narrow unlocked bindings and reject candidates that create a new collision.</p>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <span>Keybind Doctor 0.1.0</span>
        <span>MIT licensed · local-first · deterministic fixtures</span>
        <a href="https://github.com/KanadeK/keybind-doctor" target="_blank" rel="noreferrer">
          Source <ArrowSquareOut size={14} />
        </a>
      </footer>
    </div>
  );
}

function SignalLane({
  label,
  level,
  width,
}: {
  label: string;
  level: string;
  width: string;
}) {
  return (
    <div className="signal-lane">
      <span>{label}</span>
      <div>
        <i style={{ width }} />
      </div>
      <em>{level}</em>
    </div>
  );
}

function Results({
  result,
  view,
  setView,
  selectedConflict,
  onSelectConflict,
  onDownload,
}: {
  result: AnalysisResult;
  view: View;
  setView: (view: View) => void;
  selectedConflict?: Conflict;
  onSelectConflict: (id: string) => void;
  onDownload: (format: 'json' | 'markdown') => void;
}) {
  const bindings = new Map(result.bindings.map((binding) => [binding.id, binding]));
  const selectedBindings =
    selectedConflict?.bindingIds.map((id) => bindings.get(id)).filter(Boolean) ?? [];

  return (
    <div className="results">
      <div className="summary-bar" aria-live="polite">
        <div>
          <span>{result.summary.bindings}</span>
          <small>bindings</small>
        </div>
        <div>
          <span>{result.summary.definite + result.summary.shadow}</span>
          <small>high risk</small>
        </div>
        <div>
          <span>{result.summary.potential}</span>
          <small>review</small>
        </div>
        <div>
          <span>{result.summary.safeReuses}</span>
          <small>safe reuse</small>
        </div>
        <div>
          <span>{result.summary.suggestions}</span>
          <small>repairs</small>
        </div>
        <div className="summary-status">
          <span className={result.summary.unresolved === 0 ? 'status-ok' : 'status-warn'}>
            {result.summary.unresolved === 0 ? 'PLAN COMPLETE' : 'REVIEW NEEDED'}
          </span>
          <small>{result.summary.files} source files</small>
        </div>
      </div>

      <div className="result-toolbar">
        <div className="view-tabs" role="tablist" aria-label="Analysis views">
          <TabButton
            active={view === 'findings'}
            label="Findings"
            count={result.conflicts.length}
            onClick={() => setView('findings')}
          />
          <TabButton
            active={view === 'repairs'}
            label="Repair plan"
            count={result.suggestions.length}
            onClick={() => setView('repairs')}
          />
          <TabButton
            active={view === 'safe'}
            label="Safe reuse"
            count={result.safeReuses.length}
            onClick={() => setView('safe')}
          />
        </div>
        <div className="export-actions">
          <button type="button" onClick={() => onDownload('markdown')}>
            <DownloadSimple size={16} /> Markdown
          </button>
          <button type="button" onClick={() => onDownload('json')}>
            <DownloadSimple size={16} /> JSON
          </button>
        </div>
      </div>

      {view === 'findings' ? (
        <div className="finding-layout">
          <div className="finding-list" role="list" aria-label="Conflict findings">
            {result.conflicts.length === 0 ? (
              <div className="clean-state">
                <Check size={20} weight="bold" />
                No overlapping shortcuts found.
              </div>
            ) : (
              result.conflicts.map((conflict, index) => (
                <button
                  type="button"
                  role="listitem"
                  key={conflict.id}
                  className={
                    selectedConflict?.id === conflict.id
                      ? 'finding-row is-selected'
                      : 'finding-row'
                  }
                  onClick={() => onSelectConflict(conflict.id)}
                >
                  <span className={'severity-mark severity-' + conflict.severity} />
                  <span className="finding-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="finding-main">
                    <strong>{conflict.title}</strong>
                    <small>{conflict.kind + ' · ' + conflict.bindingIds.length + ' bindings'}</small>
                  </span>
                  <kbd>{displayKey(conflict.key)}</kbd>
                </button>
              ))
            )}
          </div>
          <aside className="finding-detail" aria-label="Selected finding detail">
            {selectedConflict ? (
              <>
                <div className="detail-heading">
                  <span className={'severity-label severity-' + selectedConflict.severity}>
                    {selectedConflict.severity}
                  </span>
                  <span>{selectedConflict.kind}</span>
                </div>
                <h3>{selectedConflict.title}</h3>
                <p>{selectedConflict.explanation}</p>
                <div className="detail-key">{displayKey(selectedConflict.key)}</div>
                <div className="binding-stack">
                  {selectedBindings.map((binding) =>
                    binding ? (
                      <div className="binding-item" key={binding.id}>
                        <div>
                          <strong>{binding.application}</strong>
                          <span>{binding.scope}</span>
                        </div>
                        <code>{binding.command}</code>
                        <small>
                          {binding.location.file +
                            (binding.location.line ? ':' + binding.location.line : '')}
                        </small>
                      </div>
                    ) : null,
                  )}
                </div>
              </>
            ) : (
              <span>Select a finding to inspect its evidence.</span>
            )}
          </aside>
        </div>
      ) : view === 'repairs' ? (
        <RepairTable suggestions={result.suggestions} bindings={bindings} />
      ) : (
        <div className="safe-list">
          {result.safeReuses.map((reuse) => (
            <div key={reuse.key + reuse.bindingIds.join(':')}>
              <Check size={17} weight="bold" />
              <kbd>{displayKey(reuse.key)}</kbd>
              <span>{reuse.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'is-active' : ''}
      onClick={onClick}
    >
      {label} <span>{count}</span>
    </button>
  );
}

function RepairTable({
  suggestions,
  bindings,
}: {
  suggestions: RepairSuggestion[];
  bindings: Map<string, AnalysisResult['bindings'][number]>;
}) {
  return (
    <div className="repair-table">
      <div className="repair-head">
        <span>Binding</span>
        <span>Current</span>
        <span>Suggested</span>
        <span>Cost</span>
      </div>
      {suggestions.map((suggestion) => {
        const binding = bindings.get(suggestion.bindingId);
        return (
          <div className="repair-row" key={suggestion.bindingId}>
            <span>
              <strong>{binding?.application ?? suggestion.bindingId}</strong>
              <small>{binding?.command}</small>
            </span>
            <kbd>{displayKey(suggestion.from)}</kbd>
            <span className="suggested-key">
              <ArrowSquareOut size={15} />
              <kbd>{displayKey(suggestion.to)}</kbd>
            </span>
            <span className="cost-chip">+{suggestion.cost}</span>
          </div>
        );
      })}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayKey(value: string): string {
  return value
    .split(' ')
    .map((stroke) =>
      stroke
        .split('+')
        .map(capitalize)
        .join(' + '),
    )
    .join('  ');
}
