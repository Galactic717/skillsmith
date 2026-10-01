/** What every command receives, plus small helpers commands share. */
import fs from 'node:fs';
import path from 'node:path';
import {UsageError} from '../core/errors.js';
import {isRecord} from '../core/json.js';
import {requireProjectRoot} from '../core/paths.js';
import {palette, type Io, type Palette} from '../core/term.js';
import {openProject, type Project} from '../domain/project.js';
import type {ParsedArgs} from './args.js';

/** Environment of one CLI invocation. */
export interface Context {
  cwd: string;
  env: NodeJS.ProcessEnv;
  io: Io;
  /** Folder holding .claude-plugin/, templates/ and engine/. */
  pluginRoot: string;
  /** Reads all of standard input (hook payloads). */
  readStdin(): Promise<string>;
}

/** A command handler; returns the exit code. */
export type Command = (ctx: Context, args: ParsedArgs) => Promise<number> | number;

/** Colors for this invocation. */
export function colors(ctx: Context): Palette {
  return palette(ctx.io.color);
}

/** The plugin version from .claude-plugin/plugin.json. */
export function pluginVersion(pluginRoot: string): string {
  try {
    const manifest: unknown = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'),
    );
    return isRecord(manifest) && typeof manifest['version'] === 'string'
      ? manifest['version']
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Opens the project at --dir or above the current folder. */
export function project(ctx: Context, args: ParsedArgs): Project {
  const dir = args.string('dir');
  return openProject(requireProjectRoot(ctx.cwd, dir), ctx.env);
}

/** Folder of the plugin's templates. */
export function templatesDir(ctx: Context): string {
  return path.join(ctx.pluginRoot, 'templates');
}

/** True when registry lookups should be skipped. */
export function offline(ctx: Context, args: ParsedArgs): boolean {
  return args.flag('offline') || ctx.env['SKILLSMITH_OFFLINE'] === '1';
}

/** Requires a positional argument or fails with the usage line. */
export function needPositional(args: ParsedArgs, index: number, usage: string): string {
  const value = args.positional[index];
  if (!value) throw new UsageError(`Usage: ${usage}`);
  return value;
}
