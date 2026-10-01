/** Quality tools: slop, sources, acceptance, holdout, verify, safety, ledger. */
import path from 'node:path';
import { EXIT, SkillsmithError, UsageError } from '../core/errors.js';
import { readJson, readRequiredText } from '../core/fs.js';
import { readLedger, verifyLedger } from '../core/ledger.js';
import { recordPath } from '../core/paths.js';
import { parseAcceptance, traceability } from '../domain/acceptance.js';
import { requirements } from '../domain/brief.js';
import { runCheck } from '../domain/checks.js';
import { holdoutStatus, sealHoldout } from '../domain/holdout.js';
import { runSafety } from '../domain/safety.js';
import { detectSlop } from '../domain/slop.js';
import { validateSources, verifyQuotes } from '../domain/sources.js';
import { runVacuity } from '../domain/vacuity.js';
import { colors, offline, project } from './context.js';
/** Status marks shared by every check printout. */
export function statusMark(ctx, status) {
    const c = colors(ctx);
    const marks = {
        pass: c.green('✔'),
        verified: c.green('✔'),
        fail: c.red('✘'),
        false: c.red('✘'),
        error: c.yellow('!'),
        unsafe: c.yellow('⛔'),
        unverifiable: c.dim('?'),
    };
    return marks[status] ?? '·';
}
/** Prints check rows with details for anything that did not pass. */
export function printRows(ctx, rows) {
    const c = colors(ctx);
    for (const row of rows) {
        ctx.io.out(`  ${statusMark(ctx, row.status)} ${row.id ? `${row.id} ` : ''}${row.label}`);
        if (row.status !== 'pass' && row.status !== 'verified' && row.detail) {
            ctx.io.out(c.dim(row.detail
                .split('\n')
                .map(line => `      ${line}`)
                .join('\n')));
        }
    }
}
/** `slop <file...>`: finds AI-slop phrases in English copy. */
export function slopCommand(ctx, args) {
    const c = colors(ctx);
    if (args.positional.length === 0)
        throw new UsageError('Usage: slop <file...> [--max-density N] [--json]');
    const maxDensity = args.number('max-density');
    const reports = args.positional.map(file => ({
        file,
        ...detectSlop(readRequiredText(path.resolve(ctx.cwd, file)), maxDensity),
    }));
    if (args.flag('json'))
        ctx.io.out(JSON.stringify(reports, null, 2));
    else {
        for (const report of reports) {
            ctx.io.out(`${report.pass ? c.green('✔') : c.red('✘')} ${report.file}: ${report.findings.length} finding(s), density ${report.density}/${report.maxDensity}, ${report.words} words`);
            for (const finding of report.findings) {
                const where = finding.line ? `${report.file}:${finding.line}:${finding.col}` : report.file;
                const weight = finding.weight >= 3 ? c.red(`[${finding.weight}]`) : c.yellow(`[${finding.weight}]`);
                ctx.io.out(`  ${where} ${weight} "${finding.match}"  ${c.dim(finding.hint)}`);
            }
        }
    }
    return reports.every(report => report.pass) ? EXIT.ok : EXIT.failed;
}
/** `sources check|verify [FILE]`. */
export async function sourcesCommand(ctx, args) {
    const c = colors(ctx);
    const [sub, fileArg] = args.positional;
    const file = fileArg
        ? path.resolve(ctx.cwd, fileArg)
        : recordPath(project(ctx, args).root, '02-sources.json');
    const data = readJson(file);
    if (sub === 'check') {
        const result = validateSources(data);
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(result, null, 2));
        else {
            ctx.io.out(`${result.errors.length ? c.red('✘') : c.green('✔')} ${result.verified.length} verified source(s)`);
            for (const error of result.errors)
                ctx.io.out(`  - ${c.red(error)}`);
            for (const warning of result.warnings)
                ctx.io.out(`  - ${c.yellow(warning)}`);
        }
        return result.errors.length ? EXIT.failed : EXIT.ok;
    }
    if (sub === 'verify') {
        const results = await verifyQuotes(data);
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(results, null, 2));
        else {
            const icon = {
                confirmed: c.green('✔'),
                partial: c.yellow('≈'),
                'not-found': c.red('✘'),
                unreachable: c.dim('?'),
            };
            for (const result of results) {
                ctx.io.out(`  ${icon[result.status]} ${result.id} ${result.status}  ${c.dim(result.url)}${result.detail ? `\n      ${c.dim(result.detail)}` : ''}`);
            }
            ctx.io.out(c.dim('confirmed = quote found; partial = most of it found; unreachable = the page did not load (proves nothing either way)'));
        }
        return results.some(result => result.status === 'not-found') ? EXIT.failed : EXIT.ok;
    }
    throw new UsageError('Usage: sources check|verify [FILE]');
}
/** `acceptance check [FILE] | trace | vacuity`. */
export async function acceptanceCommand(ctx, args) {
    const c = colors(ctx);
    const sub = args.positional[0];
    if (sub === 'check') {
        const fileArg = args.positional[1];
        const file = fileArg
            ? path.resolve(ctx.cwd, fileArg)
            : recordPath(project(ctx, args).root, '04-acceptance.json');
        const { file: parsed, errors } = parseAcceptance(readJson(file));
        ctx.io.out(`${errors.length ? c.red('✘') : c.green('✔')} ${parsed?.checks.length ?? 0} acceptance check(s)`);
        for (const error of errors)
            ctx.io.out(`  - ${c.red(error)}`);
        return errors.length ? EXIT.failed : EXIT.ok;
    }
    if (sub === 'trace') {
        const from = args.string('from');
        const dir = from ? path.resolve(ctx.cwd, from) : recordPath(project(ctx, args).root);
        const { file, errors } = parseAcceptance(readJson(path.join(dir, '04-acceptance.json')));
        if (!file)
            throw new SkillsmithError(`04-acceptance.json is invalid:\n- ${errors.join('\n- ')}`);
        const reqs = requirements(readRequiredText(path.join(dir, '01-brief.md')));
        const trace = traceability(file.checks, reqs.map(item => item.id));
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(trace, null, 2));
        else {
            for (const item of reqs) {
                const checks = trace.map[item.id] ?? [];
                ctx.io.out(`  ${checks.length ? c.green('✔') : c.red('✘')} ${c.bold(item.id)} ${item.text}  ${c.dim(checks.join(', ') || 'no check')}`);
            }
            for (const id of trace.unknown)
                ctx.io.out(`  ${c.red('✘')} checks cover ${id}, which the brief does not define`);
            ctx.io.out(`Coverage: ${trace.percent}% of requirements have a check.`);
        }
        return trace.uncovered.length || trace.unknown.length ? EXIT.failed : EXIT.ok;
    }
    if (sub === 'vacuity') {
        const report = await runVacuity(project(ctx, args));
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(report, null, 2));
        else {
            ctx.io.out(`Ran ${report.results.length} check(s) on ${report.commit.slice(0, 8)}, before anything is built:`);
            for (const row of report.results) {
                const vacuous = !row.guard && row.status === 'pass';
                const note = row.guard
                    ? c.dim('guard: may pass')
                    : vacuous
                        ? c.red('passes already: proves nothing')
                        : c.green('fails as it should');
                ctx.io.out(`  ${vacuous ? c.red('✘') : c.green('✔')} ${row.id} ${row.title}  ${note}`);
            }
            ctx.io.out(report.ok
                ? c.green('Every check can fail. Good.')
                : c.red(`Vacuous: ${report.vacuous.join(', ')}. Make them stricter.`));
        }
        return report.ok ? EXIT.ok : EXIT.failed;
    }
    throw new UsageError('Usage: acceptance check [FILE] | trace [--from DIR] | vacuity');
}
/** `holdout seal [--file F] | status`. */
export function holdoutCommand(ctx, args) {
    const c = colors(ctx);
    const opened = project(ctx, args);
    const sub = args.positional[0];
    if (sub === 'seal') {
        const fileArg = args.string('file');
        const status = sealHoldout(opened, fileArg ? path.resolve(ctx.cwd, fileArg) : undefined);
        ctx.io.out(`${c.green('✔')} Sealed ${status.count} hidden check(s). The draft was removed from the project; builders will never see them.`);
        return EXIT.ok;
    }
    if (sub === 'status') {
        const status = holdoutStatus(opened);
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(status, null, 2));
        else
            ctx.io.out(status.sealed
                ? `${status.count} hidden check(s) sealed at ${status.sealedAt ?? '?'}`
                : 'No hidden checks sealed.');
        return EXIT.ok;
    }
    throw new UsageError('Usage: holdout seal [--file FILE] | holdout status');
}
/** `verify --acceptance FILE [--dir DIR] [--setup]`: runs checks in a folder. */
export async function verifyCommand(ctx, args) {
    const c = colors(ctx);
    const acceptancePath = args.string('acceptance');
    if (!acceptancePath)
        throw new UsageError('Usage: verify --acceptance FILE [--dir DIR] [--setup] [--json]');
    const { file, errors } = parseAcceptance(readJson(path.resolve(ctx.cwd, acceptancePath)));
    if (!file)
        throw new SkillsmithError(`Invalid acceptance file:\n- ${errors.join('\n- ')}`);
    const dir = path.resolve(ctx.cwd, args.string('dir') ?? '.');
    const rows = [];
    if (args.flag('setup')) {
        for (const run of file.setup) {
            const outcome = await runCheck({ type: 'command', run, timeout: 900 }, { dir });
            rows.push({ id: 'setup', label: run, ...outcome });
            if (outcome.status !== 'pass')
                break;
        }
    }
    for (const check of file.checks)
        rows.push({ id: check.id, label: check.title, ...(await runCheck(check, { dir })) });
    if (args.flag('json'))
        ctx.io.out(JSON.stringify(rows, null, 2));
    else
        printRows(ctx, rows);
    const failed = rows.filter(row => row.status !== 'pass');
    ctx.io.out(failed.length
        ? c.red(`${failed.length} of ${rows.length} did not pass`)
        : c.green(`All ${rows.length} passed`));
    return failed.length ? EXIT.failed : EXIT.ok;
}
/** `safety [--dir DIR] [--offline]`: secrets and made-up dependencies. */
export async function safetyCommand(ctx, args) {
    const c = colors(ctx);
    const dir = path.resolve(ctx.cwd, args.string('dir') ?? '.');
    const report = await runSafety(dir, { offline: offline(ctx, args) });
    if (args.flag('json')) {
        ctx.io.out(JSON.stringify(report, null, 2));
        return report.clean ? EXIT.ok : EXIT.failed;
    }
    ctx.io.out(report.secrets.length
        ? `Secrets: ${report.secrets.length} finding(s)`
        : `${c.green('✔')} No secrets found`);
    for (const item of report.secrets) {
        ctx.io.out(`  ${item.blocking ? c.red('✘') : c.yellow('!')} ${item.file}${item.line ? `:${item.line}` : ''} ${item.kind}`);
    }
    const missing = report.dependencies.filter(item => item.status === 'missing');
    ctx.io.out(`Dependencies: ${report.dependencies.length} declared, ${missing.length} made up`);
    for (const item of report.dependencies) {
        if (item.status === 'exists')
            continue;
        const mark = item.status === 'missing' ? c.red('✘') : c.dim('?');
        ctx.io.out(`  ${mark} ${item.ecosystem}:${item.name} ${item.status}${item.detail ? c.dim(`  ${item.detail}`) : ''}`);
    }
    ctx.io.out(report.clean
        ? c.green('Safe to crown.')
        : c.red('Not safe: a team with these findings cannot be crowned.'));
    return report.clean ? EXIT.ok : EXIT.failed;
}
/** `ledger verify | show`. */
export function ledgerCommand(ctx, args) {
    const c = colors(ctx);
    const opened = project(ctx, args);
    const sub = args.positional[0] ?? 'verify';
    if (sub === 'show') {
        const entries = readLedger(opened.root);
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(entries, null, 2));
        else
            for (const entry of entries)
                ctx.io.out(`  ${String(entry.seq).padStart(3)} ${entry.at} ${entry.type.padEnd(13)} ${c.dim(JSON.stringify(entry.data).slice(0, 100))}`);
        return EXIT.ok;
    }
    if (sub === 'verify') {
        const result = verifyLedger(opened.root, opened.store);
        if (args.flag('json'))
            ctx.io.out(JSON.stringify(result, null, 2));
        else if (result.ok) {
            ctx.io.out(`${c.green('✔')} ${result.entries} ledger entries intact${result.macChecked ? ', signatures match' : c.yellow(' (signing key not on this machine: hash chain only)')}`);
        }
        else {
            ctx.io.out(`${c.red('✘')} The ledger was changed outside Skillsmith:`);
            for (const problem of result.problems)
                ctx.io.out(`  - ${c.red(problem)}`);
        }
        return result.ok ? EXIT.ok : EXIT.integrity;
    }
    throw new UsageError('Usage: ledger verify | ledger show [--json]');
}
