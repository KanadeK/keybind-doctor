#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { Command, Option } from 'commander';
import pc from 'picocolors';
import { analyzeInputs } from './core/analyze';
import {
  conflictsAtOrAbove,
  renderCsvReport,
  renderJsonReport,
  renderMarkdownReport,
  renderTextReport,
} from './core/report';
import type { InputFile, InputFormat, Platform } from './core/types';
import { TOOL_VERSION } from './core/types';

type OutputFormat = 'text' | 'json' | 'markdown' | 'csv';
type FailOn = 'definite' | 'potential' | 'none';

interface ScanOptions {
  platform: Platform;
  inputFormat: InputFormat;
  application?: string;
  format: OutputFormat;
  output?: string;
  failOn: FailOn;
  plan: boolean;
  strictWarnings: boolean;
  deterministic: boolean;
}

const program = new Command();
program
  .name('keybind-doctor')
  .description('Find cross-application shortcut conflicts and plan minimal repairs.')
  .version(TOOL_VERSION);

program
  .command('scan')
  .description('Analyze one or more real keybinding configuration files.')
  .argument('<files...>', 'Configuration files to analyze together')
  .addOption(
    new Option('--platform <platform>', 'Target operating system')
      .choices(['windows', 'macos', 'linux'])
      .default(defaultPlatform()),
  )
  .addOption(
    new Option('--input-format <format>', 'Force one input format for every file')
      .choices(['auto', 'vscode', 'zed', 'jetbrains', 'powertoys', 'autohotkey', 'manifest'])
      .default('auto'),
  )
  .option('--application <name>', 'Override the application name for every input')
  .addOption(
    new Option('--format <format>', 'Report format')
      .choices(['text', 'json', 'markdown', 'csv'])
      .default('text'),
  )
  .option('-o, --output <file>', 'Write the report to a file instead of stdout')
  .addOption(
    new Option('--fail-on <level>', 'Exit 1 at this finding threshold')
      .choices(['definite', 'potential', 'none'])
      .default('definite'),
  )
  .option('--no-plan', 'Skip minimum-change repair planning')
  .option('--strict-warnings', 'Treat parser warnings as input errors')
  .option(
    '--deterministic',
    'Use a fixed report timestamp for byte-stable JSON and Markdown fixtures',
  )
  .action(async (files: string[], options: ScanOptions) => {
    const inputs = await Promise.all(
      files.map(async (filePath): Promise<InputFile> => {
        const absolutePath = resolve(filePath);
        return {
          name: normalizePath(filePath),
          content: await readFile(absolutePath, 'utf8'),
          format: options.inputFormat,
          application: options.application,
        };
      }),
    );
    const result = analyzeInputs(inputs, {
      platform: options.platform,
      includePlan: options.plan,
      now: options.deterministic ? new Date('2000-01-01T00:00:00.000Z') : undefined,
    });

    if (options.strictWarnings && result.warnings.length > 0) {
      throw new InputError(
        `Parsing produced ${result.warnings.length} warning(s):\n${result.warnings.join('\n')}`,
      );
    }

    const report = renderReport(result, options.format);
    if (options.output) {
      const outputPath = resolve(options.output);
      await writeFile(outputPath, report, 'utf8');
      process.stderr.write(
        `${pc.green('Report written:')} ${normalizePath(options.output)}\n`,
      );
    } else {
      process.stdout.write(report);
    }
    if (conflictsAtOrAbove(result, options.failOn).length > 0) {
      process.exitCode = 1;
    }
  });

program
  .command('formats')
  .description('List supported input formats and auto-detection hints.')
  .action(() => {
    process.stdout.write(
      [
        'vscode     VS Code, Cursor, or Windsurf keybindings.json (JSONC)',
        'zed        Zed keymap.json (JSONC)',
        'jetbrains  IntelliJ-platform keymap XML',
        'powertoys  PowerToys Keyboard Manager default.json',
        'autohotkey AutoHotkey v1/v2 .ahk hotkey declarations',
        'manifest   Keybind Doctor portable manifest v1',
        '',
      ].join('\n'),
    );
  });

class InputError extends Error {}

function renderReport(
  result: ReturnType<typeof analyzeInputs>,
  format: OutputFormat,
): string {
  switch (format) {
    case 'json':
      return renderJsonReport(result);
    case 'markdown':
      return renderMarkdownReport(result);
    case 'csv':
      return renderCsvReport(result);
    case 'text':
      return renderTextReport(result);
  }
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function defaultPlatform(): Platform {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'linux') return 'linux';
  return 'windows';
}

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = error instanceof InputError ? 'Input error' : 'Failed';
  process.stderr.write(`${pc.red(prefix)}: ${message}\n`);
  process.stderr.write(
    `Run "${basename(process.argv[1] ?? 'keybind-doctor')} scan --help" for usage.\n`,
  );
  process.exitCode = 2;
});
