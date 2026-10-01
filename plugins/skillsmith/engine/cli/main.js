/** Command dispatch, help text and error handling. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage, EXIT, SkillsmithError } from '../core/errors.js';
import { isRecord } from '../core/json.js';
import { palette, processIo } from '../core/term.js';
import { writeDashboard } from '../domain/report/dashboard.js';
import { writeReport } from '../domain/report/report.js';
import { preToolUse, sessionStart, stopGuard } from '../hooks/handlers.js';
import { parseArgs } from './args.js';
import { arenaCommand } from './arena.js';
import { colors, pluginVersion, project } from './context.js';
import { advanceCommand, briefCommand, doctorCommand, gateCommand, initCommand, statusCommand, templateCommand, } from './pipeline.js';
import { acceptanceCommand, holdoutCommand, ledgerCommand, safetyCommand, slopCommand, sourcesCommand, verifyCommand, } from './quality.js';
function help(version) {
    return `skillsmith ${version}: your idea in, a verified product out.

Pipeline
  init [--name N]                        start a project in this folder
  status [--json]                        where the line is and what comes next
  gate <station> [--from DIR]            check a station's output without moving on
  advance <station> [--skip REASON]      pass the gate and mark the station done
                                         (research and hooks can be skipped)
  brief [FILE] [--json]                  requirements, success criteria, idea check
  template <name>                        print a template
  doctor                                 check Node, git and the project's records

Quality
  slop <file...> [--max-density N]       find AI-slop phrases in English copy
  sources check|verify [FILE]            validate sources / look for each quote online
  acceptance check [FILE]                validate 04-acceptance.json
  acceptance trace [--from DIR]          map every requirement to its checks
  acceptance vacuity                     prove every check fails before work starts
  holdout seal [--file F] | status       hide extra checks from the builders
  verify --acceptance FILE [--dir D] [--setup]
                                         run acceptance checks in a folder
  safety [--dir D] [--offline]           committed secrets and made-up dependencies
  ledger verify | show                   check the signed record of every decision

Arena
  arena init [--teams a,b,c | --count N]
  arena status [--json]
  arena paths <team>                     worktree, dossier and claim file locations
  arena precheck <team>|--all            private run: nothing recorded, nobody dies
  arena verify <team>|--all              official run; a false claim or tampering kills
  arena accuse <team> [--dry-run]        run the team's accusations; perjury kills
  arena eliminate <team> --reason TEXT
  arena judge                            accept and sign the auditor's judge.json
  arena score [--json]
  arena round                            start the next round
  arena crown [team] [--force]           merge the winner, retire honest losers
  arena fuse --from <team>               re-verify after porting a loser's strengths

Output
  report                                 write .skillsmith/REPORT.md
  dashboard [--out FILE]                 write .skillsmith/dashboard.html

Common flags: --dir DIR (project folder), --json, --no-setup, --offline
Exit codes: 0 ok, 1 check failed, 2 usage, 3 unexpected, 4 records tampered`;
}
function reportCommand(ctx, args) {
    ctx.io.out(`${colors(ctx).green('✔')} ${writeReport(project(ctx, args))}`);
    return EXIT.ok;
}
function dashboardCommand(ctx, args) {
    const out = args.string('out');
    ctx.io.out(`${colors(ctx).green('✔')} ${writeDashboard(project(ctx, args), out ? path.resolve(ctx.cwd, out) : undefined)}`);
    return EXIT.ok;
}
async function hookCommand(ctx, args) {
    try {
        const raw = await ctx.readStdin();
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        const input = isRecord(parsed) ? parsed : {};
        let output;
        switch (args.positional[0]) {
            case 'session-start':
                output = sessionStart(input, ctx.env);
                break;
            case 'pre-tool-use':
                output = preToolUse(input, ctx.env);
                break;
            case 'stop':
                output = stopGuard(input, ctx.env);
                break;
            default:
                output = undefined;
        }
        if (output)
            ctx.io.out(JSON.stringify(output));
    }
    catch {
        // A hook must never break the session because of its own bug.
    }
    return EXIT.ok;
}
const COMMANDS = {
    init: initCommand,
    status: statusCommand,
    gate: gateCommand,
    advance: advanceCommand,
    brief: briefCommand,
    template: templateCommand,
    doctor: doctorCommand,
    slop: slopCommand,
    sources: sourcesCommand,
    acceptance: acceptanceCommand,
    holdout: holdoutCommand,
    verify: verifyCommand,
    safety: safetyCommand,
    ledger: ledgerCommand,
    arena: arenaCommand,
    report: reportCommand,
    dashboard: dashboardCommand,
    hook: hookCommand,
};
const ALIASES = {
    '--help': 'help',
    '-h': 'help',
    '--version': 'version',
    '-v': 'version',
};
/** Runs one CLI invocation and returns its exit code. Never throws. */
export async function run(argv, ctx) {
    const [first, ...rest] = argv;
    const name = ALIASES[first ?? ''] ?? first ?? 'help';
    const version = pluginVersion(ctx.pluginRoot);
    if (name === 'help') {
        ctx.io.out(help(version));
        return EXIT.ok;
    }
    if (name === 'version') {
        ctx.io.out(version);
        return EXIT.ok;
    }
    const command = COMMANDS[name];
    if (!command) {
        ctx.io.err(`Unknown command "${name}".\n\n${help(version)}`);
        return EXIT.usage;
    }
    try {
        const args = parseArgs(rest);
        if (args.flag('help')) {
            ctx.io.out(help(version));
            return EXIT.ok;
        }
        return await command(ctx, args);
    }
    catch (error) {
        const c = palette(ctx.io.color);
        if (error instanceof SkillsmithError) {
            ctx.io.err(`${c.red('✘')} ${error.message}${error.hint ? `\n  ${error.hint}` : ''}`);
            return error.exitCode;
        }
        ctx.io.err(`${c.red('Unexpected error:')} ${error instanceof Error ? (error.stack ?? error.message) : errorMessage(error)}`);
        return EXIT.unexpected;
    }
}
async function readProcessStdin() {
    if (process.stdin.isTTY)
        return '';
    const chunks = [];
    for await (const chunk of process.stdin)
        chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}
/** Context for a real process; the plugin root is two folders above this file. */
export function processContext(moduleUrl) {
    const here = path.dirname(fileURLToPath(moduleUrl));
    return {
        cwd: process.cwd(),
        env: process.env,
        io: processIo(),
        pluginRoot: process.env['SKILLSMITH_PLUGIN_ROOT'] ?? path.resolve(here, '..'),
        readStdin: readProcessStdin,
    };
}
