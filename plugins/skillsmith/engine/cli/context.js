/** What every command receives, plus small helpers commands share. */
import fs from 'node:fs';
import path from 'node:path';
import { UsageError } from '../core/errors.js';
import { isRecord } from '../core/json.js';
import { requireProjectRoot } from '../core/paths.js';
import { palette } from '../core/term.js';
import { openProject } from '../domain/project.js';
/** Colors for this invocation. */
export function colors(ctx) {
    return palette(ctx.io.color);
}
/** The plugin version from .claude-plugin/plugin.json. */
export function pluginVersion(pluginRoot) {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
        return isRecord(manifest) && typeof manifest['version'] === 'string'
            ? manifest['version']
            : 'unknown';
    }
    catch {
        return 'unknown';
    }
}
/** Opens the project at --dir or above the current folder. */
export function project(ctx, args) {
    const dir = args.string('dir');
    return openProject(requireProjectRoot(ctx.cwd, dir), ctx.env);
}
/** Folder of the plugin's templates. */
export function templatesDir(ctx) {
    return path.join(ctx.pluginRoot, 'templates');
}
/** True when registry lookups should be skipped. */
export function offline(ctx, args) {
    return args.flag('offline') || ctx.env['SKILLSMITH_OFFLINE'] === '1';
}
/** Requires a positional argument or fails with the usage line. */
export function needPositional(args, index, usage) {
    const value = args.positional[index];
    if (!value)
        throw new UsageError(`Usage: ${usage}`);
    return value;
}
