/** `arena ...` subcommands. */
import {EXIT, UsageError} from '../core/errors.js';
import {readRequiredText} from '../core/fs.js';
import {recordPath} from '../core/paths.js';
import {accuse} from '../domain/arena/accuse.js';
import {crown, eliminate, fuse, nextRound} from '../domain/arena/crown.js';
import {initArena} from '../domain/arena/init.js';
import {describeEvent, requireArena, teamPaths, type Verdict} from '../domain/arena/model.js';
import {acceptJudge, computeScore} from '../domain/arena/score.js';
import {verifyTeams} from '../domain/arena/trial.js';
import type {ParsedArgs} from './args.js';
import {colors, needPositional, offline, project, templatesDir, type Context} from './context.js';
import {printRows} from './quality.js';

function printVerdict(ctx: Context, verdict: Verdict): void {
  const c = colors(ctx);
  const io = ctx.io;
  io.out(
    `${c.bold(`${verdict.team} (${verdict.persona})`)} ${verdict.mode} at ${verdict.commit.slice(0, 8)}: ${verdict.commits} commit(s), +${verdict.diff.added}/−${verdict.diff.removed} lines since the arena opened`,
  );
  if (verdict.uncommitted)
    io.out(
      c.yellow(
        `  ${verdict.uncommitted} uncommitted change(s) in the worktree were NOT judged. Commit them.`,
      ),
    );
  if (verdict.tampered.length) {
    io.out(c.red('  Protected files changed:'));
    for (const file of verdict.tampered) io.out(`  - ${c.red(file)}`);
  }
  if (verdict.setup.length)
    printRows(
      ctx,
      verdict.setup.map(row => ({
        id: 'setup',
        label: row.run,
        status: row.status,
        detail: row.detail,
      })),
    );
  io.out(`  Acceptance ${verdict.acceptance.passed}/${verdict.acceptance.total}:`);
  printRows(
    ctx,
    verdict.acceptance.results.map(row => ({
      id: row.id,
      label: row.title,
      status: row.status,
      detail: row.detail,
    })),
  );
  if (verdict.holdout.ran) {
    io.out(`  Hidden checks ${verdict.holdout.passed}/${verdict.holdout.total}:`);
    printRows(
      ctx,
      verdict.holdout.results.map(row => ({id: row.id, label: row.title, status: row.status})),
    );
  }
  const blocking = verdict.safety.secrets.filter(item => item.blocking);
  const missing = verdict.safety.dependencies.filter(item => item.status === 'missing');
  if (!verdict.safety.clean) {
    io.out(c.red('  Safety problems (this team cannot be crowned until they are fixed):'));
    for (const item of blocking)
      io.out(`  - ${c.red(`${item.kind} in ${item.file}${item.line ? `:${item.line}` : ''}`)}`);
    for (const item of missing) io.out(`  - ${c.red(item.detail)}`);
  }
  for (const error of verdict.claims.filed ? verdict.claims.errors : [])
    io.out(`  - ${c.yellow(`claims: ${error}`)}`);
  if (verdict.claims.results.length) {
    io.out(
      `  Claims: ${verdict.claims.verified} proven, ${verdict.claims.false} false, ${verdict.claims.unverifiable} without proof`,
    );
    printRows(
      ctx,
      verdict.claims.results.map(row => ({
        id: row.id,
        label: row.text,
        status: row.status,
        detail: row.detail,
      })),
    );
  }
  const outcome =
    verdict.outcome === 'alive'
      ? c.green('ALIVE')
      : verdict.outcome === 'dead'
        ? c.red(`DEAD (${verdict.cause ?? ''})`)
        : c.yellow('NO CLAIMS FILED');
  io.out(`  Outcome: ${verdict.mode === 'precheck' ? c.dim('(precheck) ') : ''}${outcome}`);
  if (verdict.mode === 'precheck' && verdict.outcome === 'dead') {
    io.out(
      c.yellow(
        '  An official verify would eliminate this team. Fix the work or withdraw the claim.',
      ),
    );
  }
  if (verdict.mode === 'verify' && verdict.outcome === 'dead') {
    io.out(c.red('  Worktree and branch deleted. The evidence is in .skillsmith/graveyard.md'));
  }
  if (verdict.outcome === 'no-claims')
    io.out(
      c.yellow(
        `  File claims at .skillsmith/teams/${verdict.team}/claims.json, then verify again.`,
      ),
    );
}

const USAGE =
  'arena init|status|paths|precheck|verify|accuse|eliminate|judge|score|round|crown|fuse';

/** Dispatches `arena <sub>`. */
export async function arenaCommand(ctx: Context, args: ParsedArgs): Promise<number> {
  const c = colors(ctx);
  const io = ctx.io;
  const opened = project(ctx, args);
  const [sub, name] = args.positional;
  const setup = !args.flag('no-setup');
  switch (sub) {
    case 'init': {
      const teams = args.list('teams');
      const count = args.number('count');
      const result = initArena(opened, {
        ...(teams ? {teams} : {}),
        ...(count === undefined ? {} : {count}),
        force: args.flag('force'),
        templatesDir: templatesDir(ctx),
      });
      if (result.identity.length)
        io.out(c.dim(`set a local git identity for this project (${result.identity.join(', ')})`));
      if (result.strayChanges.length)
        io.out(
          c.yellow(
            `Uncommitted files outside .skillsmith/ are not in the teams' copies:\n${result.strayChanges.join('\n')}`,
          ),
        );
      for (const warning of result.warnings) io.out(c.yellow(warning));
      io.out(
        `${c.green('✔')} Arena open. Base commit ${result.arena.base.slice(0, 8)}. Protected: ${result.arena.protected.join(', ')}`,
      );
      if (result.arena.holdout)
        io.out(
          `  ${result.arena.holdout.count} hidden check(s) will run at every official verification.`,
        );
      for (const paths of result.paths) {
        const team = result.arena.teams[paths.team];
        io.out(`\n  ${c.bold(paths.team)} (${team?.persona ?? ''}): ${team?.motto ?? ''}`);
        io.out(`    worktree  ${paths.worktree}`);
        io.out(`    orders    ${paths.orders}`);
        io.out(`    claims    ${paths.claims}`);
      }
      return EXIT.ok;
    }
    case 'status': {
      const arena = requireArena(opened.root);
      if (args.flag('json')) {
        io.out(JSON.stringify(arena, null, 2));
        return EXIT.ok;
      }
      io.out(
        `Arena ${arena.status}, round ${arena.round}${arena.winner ? `, winner ${arena.winner}` : ''}`,
      );
      for (const [teamName, team] of Object.entries(arena.teams))
        io.out(`  ${teamName.padEnd(8)} ${team.persona.padEnd(9)} ${team.status}`);
      io.out(c.dim('\nLast events:'));
      for (const event of arena.events.slice(-8))
        io.out(c.dim(`  ${event.at.slice(11, 16)} ${describeEvent(event)}`));
      return EXIT.ok;
    }
    case 'paths': {
      requireArena(opened.root);
      io.out(
        JSON.stringify(
          teamPaths(opened.root, needPositional(args, 1, 'arena paths <team>')),
          null,
          2,
        ),
      );
      return EXIT.ok;
    }
    case 'precheck':
    case 'verify': {
      const all = args.flag('all');
      if (!name && !all) throw new UsageError(`Usage: arena ${sub} <team> | --all`);
      const verdicts = await verifyTeams(opened, all ? [] : [name ?? ''], {
        mode: sub,
        setup,
        offline: offline(ctx, args),
      });
      if (args.flag('json'))
        io.out(JSON.stringify(verdicts.length === 1 ? verdicts[0] : verdicts, null, 2));
      else verdicts.forEach(verdict => printVerdict(ctx, verdict));
      return verdicts.every(verdict => verdict.outcome === 'alive') ? EXIT.ok : EXIT.failed;
    }
    case 'accuse': {
      const accuser = needPositional(args, 1, 'arena accuse <team> [--dry-run]');
      const result = await accuse(opened, accuser, {setup, dryRun: args.flag('dry-run')});
      if (args.flag('json')) {
        io.out(JSON.stringify(result, null, 2));
        return result.died ? EXIT.failed : EXIT.ok;
      }
      if (result.dryRun)
        io.out(
          c.dim(
            'Dry run: nothing recorded, nobody dies. "false" here means the official run would eliminate the accuser.',
          ),
        );
      for (const item of result.results) {
        const icon =
          item.status === 'upheld'
            ? c.green('⚔ upheld')
            : item.status === 'false'
              ? c.red('✘ false')
              : c.dim('· dismissed');
        io.out(`  ${icon}  ${item.id} vs ${item.against}: ${item.text}`);
        if (item.status !== 'upheld' && item.detail)
          io.out(
            c.dim(
              item.detail
                .split('\n')
                .map(line => `      ${line}`)
                .join('\n'),
            ),
          );
      }
      if (result.died) io.out(c.red(`${accuser} accused without proof and is eliminated.`));
      return result.died ? EXIT.failed : EXIT.ok;
    }
    case 'eliminate': {
      const team = needPositional(args, 1, 'arena eliminate <team> --reason "..."');
      eliminate(opened, team, args.string('reason') ?? '');
      io.out(c.red(`${team} eliminated.`));
      return EXIT.ok;
    }
    case 'judge': {
      const errors = acceptJudge(opened);
      if (errors.length) {
        io.out(c.red('✘ judge.json is not acceptable:'));
        for (const error of errors) io.out(`  - ${c.red(error)}`);
        return EXIT.failed;
      }
      io.out(`${c.green('✔')} Judge scores accepted and signed.`);
      return EXIT.ok;
    }
    case 'score': {
      const board = computeScore(opened);
      if (args.flag('json')) io.out(JSON.stringify(board, null, 2));
      else io.out(readRequiredText(recordPath(opened.root, 'scoreboard.md')));
      return EXIT.ok;
    }
    case 'round': {
      io.out(`Round ${nextRound(opened)} started.`);
      return EXIT.ok;
    }
    case 'crown': {
      const result = crown(opened, name, {force: args.flag('force')});
      io.out(
        `${c.green('♛')} ${result.winner} (${result.persona}) wins. Their work is merged into your project.`,
      );
      if (result.tooCloseToCall)
        io.out(
          c.yellow(
            'It was too close to call. Consider `skillsmith arena fuse --from <runner-up>` after porting their best parts.',
          ),
        );
      return EXIT.ok;
    }
    case 'fuse': {
      const from = args.string('from');
      if (!from) throw new UsageError('Usage: arena fuse --from <team>');
      const result = await fuse(opened, from);
      if (result.ok)
        io.out(
          `${c.green('✔')} Fusion kept: every check that passed for the winner still passes${result.improvements.length ? `; newly passing: ${result.improvements.join(', ')}` : ''}.`,
        );
      else
        io.out(c.red(`✘ Fusion broke ${result.regressions.join(', ')}. Undo it: git revert HEAD`));
      return result.ok ? EXIT.ok : EXIT.failed;
    }
    default:
      throw new UsageError(`Usage: ${USAGE}`);
  }
}
