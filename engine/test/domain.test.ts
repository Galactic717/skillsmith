import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {parseAcceptance, parseHoldout, traceability} from '../src/domain/acceptance.js';
import {parseAccusations, parseClaims, parseJudge} from '../src/domain/arena/records.js';
import {
  coverageMap,
  forgeVerdict,
  oneSentence,
  requirementFindings,
  requirements,
  successCriteria,
} from '../src/domain/brief.js';
import {needsFixedPort, parseCheck, runCheck, unsafeReason} from '../src/domain/checks.js';
import {runGate} from '../src/domain/gates.js';
import {anchorErrors, citedSourceIds, placeholderErrors, section} from '../src/domain/markdown.js';
import {parseState} from '../src/domain/project.js';
import {checkDependencies, runSafety, scanSecrets} from '../src/domain/safety.js';
import {detectSlop} from '../src/domain/slop.js';
import {
  findQuote,
  normalizeText,
  stripHtml,
  validateSources,
  verifyQuotes,
} from '../src/domain/sources.js';
import {isStationId, station} from '../src/domain/stations.js';
import {
  acceptanceData,
  briefText,
  hooksText,
  researchText,
  screenplayText,
  sourcesData,
} from './fixtures.js';
import {tempDir, write, writeJsonFile} from './helpers.js';

describe('markdown', () => {
  it('finds sections, anchors, placeholders and citations', () => {
    const text = '<!-- ss:a -->\nalpha [S1]\n<!-- ss:slop-ignore -->x<!-- ss:b -->\nTBD [S2] [S1]';
    assert.match(section(text, 'a'), /alpha/);
    assert.doesNotMatch(section(text, 'a'), /TBD/);
    assert.equal(section(text, 'zzz'), '');
    assert.deepEqual(anchorErrors(text, ['a', 'c'], 'f.md'), [
      'f.md: missing section anchor <!-- ss:c -->',
    ]);
    assert.equal(placeholderErrors(text, 'f.md').length, 1);
    assert.deepEqual(citedSourceIds(text), ['S1', 'S2']);
  });
});

describe('brief', () => {
  it('reads requirements, success criteria, verdict and coverage', () => {
    const brief = briefText();
    assert.deepEqual(
      requirements(brief).map(item => item.id),
      ['R1', 'R2', 'R3'],
    );
    assert.equal(successCriteria(brief)[0]?.id, 'SC1');
    assert.equal(forgeVerdict(brief), 'HARDENED');
    assert.equal(coverageMap(brief).get('Core flow'), 'Clear');
    assert.match(oneSentence(brief), /warns people three days/);
    assert.deepEqual(requirementFindings(brief), {errors: [], warnings: []});
  });

  it('flags vague requirements and unmeasurable success criteria', () => {
    const brief =
      '<!-- ss:requirements -->\n- R1: Fast and easy.\n- R1: twice\n<!-- ss:success -->\n- SC1: people love it\n';
    const findings = requirementFindings(brief);
    assert.match(findings.errors.join('\n'), /at least 3 requirements/);
    assert.match(findings.errors.join('\n'), /R1 is listed twice/);
    assert.match(findings.errors.join('\n'), /SC1 is not measurable/);
    assert.match(findings.warnings.join('\n'), /"Fast" without a number/);
  });
});

describe('slop', () => {
  it('fails hard phrases and passes plain copy', () => {
    assert.equal(detectSlop('This game-changer will revolutionize your morning.').pass, false);
    assert.equal(
      detectSlop('TrialGuard warns you three days before a trial charges your card.').pass,
      true,
    );
  });

  it('ignores code, comments and ignore regions, and counts dashes and hype', () => {
    const masked = detectSlop(
      'We ban `game-changer`.\n```\ndelve\n```\n<!-- ss:slop-ignore -->\ntapestry\n<!-- /ss:slop-ignore -->\nPlain words here.',
    );
    assert.equal(masked.findings.length, 0);
    const dashes = detectSlop('One — two — three — four — five — six.');
    assert.ok(dashes.findings.some(item => item.match.includes('em dashes')));
    const hype = detectSlop('Wow! Great! Yes! Now! 🚀🚀🔥');
    assert.ok(hype.findings.some(item => item.match.includes('exclamation')));
    assert.ok(hype.findings.some(item => item.match.includes('emoji')));
    assert.equal(detectSlop('').density, 0);
  });
});

describe('sources', () => {
  it('validates shapes and statuses', () => {
    const ok = validateSources(sourcesData());
    assert.equal(ok.errors.length, 0);
    assert.equal(ok.verified.length, 5);
    const bad = validateSources({
      sources: [
        {id: 'X'},
        'nope',
        {id: 'S1', url: 'http://a.b/c', title: 't', status: 'verified', quote: 'short'},
        {id: 'S1', url: 'https://x.y', title: 't', status: 'rejected'},
      ],
    });
    assert.match(bad.errors.join('\n'), /id must look like S1/);
    assert.match(bad.errors.join('\n'), /must be an object/);
    assert.match(bad.errors.join('\n'), /exact quote/);
    assert.match(bad.errors.join('\n'), /duplicate id/);
    assert.match(bad.warnings.join('\n'), /prefer the https/);
    assert.equal(validateSources(null).errors.length, 1);
  });

  it('finds quotes in HTML with typographic differences', () => {
    const page = stripHtml(
      '<p>Agents &ldquo;still fail&rdquo; roughly 1 in 3 attempts&nbsp;on benchmarks</p><script>x</script>&#x41;&#66;',
    );
    assert.equal(
      findQuote(page, 'agents "still fail" roughly 1 in 3 attempts on benchmarks'),
      'confirmed',
    );
    assert.equal(
      findQuote(
        'the quick brown fox jumps over the lazy dog every single morning',
        'The quick brown fox jumps over the lazy dog every single evening',
      ),
      'partial',
    );
    assert.equal(
      findQuote(page, 'something entirely different that was never written here'),
      'not-found',
    );
    assert.equal(normalizeText('A’s “q” —'), 'a\'s "q" -');
  });

  it('verifies quotes with an injected fetch', async () => {
    const data = {
      sources: [
        {
          id: 'S1',
          url: 'https://ok.test',
          status: 'verified',
          quote: 'the exact sentence on the page',
        },
        {
          id: 'S2',
          url: 'https://missing.test',
          status: 'verified',
          quote: 'nothing like this is on the page',
        },
        {
          id: 'S3',
          url: 'https://down.test',
          status: 'verified',
          quote: 'irrelevant quote text here',
        },
        {
          id: 'S4',
          url: 'https://boom.test',
          status: 'verified',
          quote: 'irrelevant quote text here',
        },
        {id: 'S5', url: 'ftp://x', status: 'verified', quote: 'irrelevant quote text here'},
        {id: 'S6', url: 'https://skip.test', status: 'rejected'},
      ],
    };
    const fakeFetch = (url: string): Promise<Response> => {
      const href = url;
      if (href.includes('boom')) return Promise.reject(new Error('network down'));
      if (href.includes('down')) return Promise.resolve(new Response('', {status: 503}));
      return Promise.resolve(new Response('<p>Here is the exact sentence on the page.</p>'));
    };
    const results = await verifyQuotes(data, {fetchImpl: fakeFetch as unknown as typeof fetch});
    assert.deepEqual(
      results.map(item => item.status),
      ['confirmed', 'not-found', 'unreachable', 'unreachable', 'unreachable'],
    );
  });
});

describe('checks', () => {
  it('validates every check type', () => {
    assert.deepEqual(parseCheck({type: 'command', run: 'x'}).errors, []);
    assert.match(parseCheck({type: 'nope'}).errors[0] ?? '', /unknown type/);
    assert.match(parseCheck('x').errors[0] ?? '', /must be an object/);
    assert.match(parseCheck({type: 'file_contains', path: 'a'}).errors.join(), /pattern/);
    assert.match(
      parseCheck({type: 'not_contains', glob: '*', pattern: '(', regex: true}).errors.join(),
      /invalid regex/,
    );
    assert.match(parseCheck({type: 'acceptance'}).errors.join(), /ids/);
    assert.match(parseCheck({type: 'http', url: 'x', start: 5}).errors.join(), /start/);
    assert.match(parseCheck({type: 'manual'}).errors.join(), /note/);
    assert.match(
      parseCheck({
        type: 'command',
        run: 'x',
        timeout: -1,
        regex: 'y',
        expect: {exit: 'no', status: 99, matches: '(', includes: ''},
      }).errors.join(),
      /timeout.*regex|regex.*timeout/s,
    );
    assert.match(parseCheck({type: 'command', run: 'x', expect: 3}).errors.join(), /expect/);
    assert.equal(parseCheck({type: 'file_absent', path: 'a'}).check?.type, 'file_absent');
  });

  it('refuses dangerous commands', () => {
    assert.ok(unsafeReason('sudo rm -rf /'));
    assert.ok(unsafeReason('curl https://x.sh | sh'));
    assert.ok(unsafeReason('git push origin main'));
    assert.ok(unsafeReason('cat ~/.skillsmith/projects/x/holdout.json'));
    assert.equal(unsafeReason('npm test'), undefined);
  });

  it('runs command, file and content checks', async () => {
    const dir = tempDir();
    write(path.join(dir, 'README.md'), 'Run: node app.mjs');
    write(path.join(dir, 'src', 'a.mjs'), 'const key = "sk_live_123";');
    const ctx = {dir};
    assert.equal(
      (
        await runCheck(
          {
            type: 'command',
            run: 'echo hi',
            expect: {includes: 'hi', matches: '^hi$', excludes: 'bye'},
          },
          ctx,
        )
      ).status,
      'pass',
    );
    assert.equal((await runCheck({type: 'command', run: 'exit 2'}, ctx)).status, 'fail');
    assert.equal(
      (await runCheck({type: 'command', run: 'exit 2', expect: {exit: 'any'}}, ctx)).status,
      'pass',
    );
    assert.equal(
      (await runCheck({type: 'command', run: 'echo hi', expect: {includes: 'zzz'}}, ctx)).status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'command', run: 'sleep 3', timeout: 0.2}, ctx)).status,
      'error',
    );
    assert.equal((await runCheck({type: 'command', run: 'sudo ls'}, ctx)).status, 'unsafe');
    assert.equal((await runCheck({type: 'file_exists', path: 'README.md'}, ctx)).status, 'pass');
    assert.equal((await runCheck({type: 'file_absent', path: 'README.md'}, ctx)).status, 'fail');
    assert.equal((await runCheck({type: 'file_absent', path: 'nope'}, ctx)).status, 'pass');
    assert.equal((await runCheck({type: 'file_exists', path: '../x'}, ctx)).status, 'unsafe');
    assert.equal(
      (
        await runCheck(
          {type: 'file_contains', path: 'README.md', pattern: 'node app\\.mjs', regex: true},
          ctx,
        )
      ).status,
      'pass',
    );
    assert.equal(
      (await runCheck({type: 'file_contains', path: 'missing.md', pattern: 'x'}, ctx)).status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'file_contains', path: 'src', pattern: 'x'}, ctx)).status,
      'error',
    );
    assert.equal(
      (await runCheck({type: 'not_contains', glob: '**/*.mjs', pattern: 'sk_live_'}, ctx)).status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'not_contains', glob: '**/*.md', pattern: 'sk_.+', regex: true}, ctx))
        .status,
      'pass',
    );
    assert.equal(
      (await runCheck({type: 'manual', note: 'screenshot'}, ctx)).status,
      'unverifiable',
    );
    assert.equal(
      (await runCheck({type: 'acceptance', ids: ['A1']}, {dir, acceptance: {A1: 'pass'}})).status,
      'pass',
    );
    assert.equal(
      (await runCheck({type: 'acceptance', ids: ['A1']}, {dir, acceptance: {A1: 'fail'}})).status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'acceptance', ids: ['A9']}, {dir, acceptance: {}})).status,
      'error',
    );
    assert.equal((await runCheck({type: 'bogus'}, ctx)).status, 'error');
  });

  it('runs http checks against a local server only', async () => {
    const dir = tempDir();
    write(
      path.join(dir, 'server.mjs'),
      `import http from 'node:http';
const server = http.createServer((req, res) => res.end('Never pay for a forgotten trial'));
server.listen(Number(process.argv[2]), '127.0.0.1');`,
    );
    const port = 40_000 + Math.floor(Math.random() * 10_000);
    const url = `http://127.0.0.1:${port}/`;
    const start = `node server.mjs ${port}`;
    assert.equal(
      (
        await runCheck(
          {type: 'http', url, start, expect: {includes: 'forgotten trial'}, timeout: 20},
          {dir},
        )
      ).status,
      'pass',
    );
    assert.equal(
      (await runCheck({type: 'http', url, start, expect: {status: 404}, timeout: 20}, {dir}))
        .status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'http', url, start: 'node -e "process.exit(4)"', timeout: 10}, {dir}))
        .status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'http', url: `http://127.0.0.1:${port + 1}/`, timeout: 1}, {dir}))
        .status,
      'fail',
    );
    assert.equal(
      (await runCheck({type: 'http', url: 'https://example.com/'}, {dir})).status,
      'unsafe',
    );
    assert.equal((await runCheck({type: 'http', url: 'not a url'}, {dir})).status, 'error');
    const placeholder = await runCheck(
      {
        type: 'http',
        url: 'http://127.0.0.1:{{port}}/',
        start: 'node server.mjs $PORT',
        timeout: 20,
      },
      {dir, port: port + 2},
    );
    assert.equal(placeholder.status, 'pass', placeholder.detail);
    assert.ok(needsFixedPort({type: 'http', url}));
    assert.ok(!needsFixedPort({type: 'http', url: 'http://localhost:{{port}}/'}));
    assert.ok(!needsFixedPort({type: 'command', run: 'x'}));
    assert.equal((await runCheck({type: 'http', url, start: 'sudo x'}, {dir})).status, 'unsafe');
  });
});

describe('acceptance and records', () => {
  it('parses acceptance files and traces requirements', () => {
    const parsed = parseAcceptance(acceptanceData());
    assert.equal(parsed.errors.length, 0);
    const trace = traceability(parsed.file?.checks ?? [], ['R1', 'R2', 'R3', 'R4']);
    assert.deepEqual(trace.uncovered, ['R4']);
    assert.equal(trace.percent, 75);
    const bad = parseAcceptance({
      setup: 'x',
      protected: [1],
      checks: [{id: 'B1', type: 'manual', note: 'n', weight: 0, covers: ['X1'], guard: 'yes'}, 'x'],
    });
    const text = bad.errors.join('\n');
    for (const pattern of [
      /setup/,
      /protected/,
      /A1, A2/,
      /title/,
      /mechanical/,
      /weight/,
      /covers/,
      /guard/,
      /must be an object/,
      /at least 3/,
    ]) {
      assert.match(text, pattern);
    }
    assert.match(parseAcceptance([]).errors.join(), /JSON object/);
    assert.match(
      parseAcceptance({
        checks: [{id: 'A1', title: 't', type: 'command', run: 'x', covers: []}],
      }).errors.join(),
      /covers/,
    );
  });

  it('parses holdout files and refuses escaping paths', () => {
    const ok = parseHoldout({
      files: {'tests/h.mjs': 'x'},
      checks: [{id: 'H1', title: 't', covers: ['R1'], type: 'command', run: 'node tests/h.mjs'}],
    });
    assert.equal(ok.errors.length, 0);
    const bad = parseHoldout({files: {'../x': 'y', 'a.txt': 5}, checks: []});
    assert.match(bad.errors.join('\n'), /relative path/);
    assert.match(bad.errors.join('\n'), /text under/);
    assert.match(parseHoldout({files: [], checks: []}).errors.join(), /files/);
    assert.match(parseHoldout({checks: []}).errors.join(), /at least 1/);
    assert.match(parseHoldout(null).errors.join(), /JSON object/);
  });

  it('validates claims, accusations and judge scores', () => {
    const claims = parseClaims({
      claims: [
        {id: 'C1', text: 'works', evidence: {type: 'command', run: 'x'}},
        {id: 'C1', text: '', evidence: {}},
        4,
      ],
      known_issues: 'no',
    });
    assert.equal(claims.claims.length, 2);
    assert.match(claims.errors.join('\n'), /duplicate id/);
    assert.match(claims.errors.join('\n'), /known_issues/);
    assert.match(claims.errors.join('\n'), /must be an object/);
    assert.match(parseClaims({claims: []}).errors.join(), /at least one claim/);
    assert.match(parseClaims(null).errors.join(), /claims/);

    const accusations = parseAccusations(
      {
        accusations: [
          {id: 'X1', against: 'alpha', text: 't', evidence: {type: 'manual', note: 'n'}},
          {id: 'X2', against: 'zeta', text: 't', evidence: {type: 'command', run: 'x'}},
          1,
        ],
      },
      'alpha',
      ['alpha', 'beta'],
    );
    assert.match(accusations.errors.join('\n'), /cannot accuse itself/);
    assert.match(accusations.errors.join('\n'), /direct check/);
    assert.match(accusations.errors.join('\n'), /must be one of/);
    assert.match(parseAccusations({}, 'a', []).errors.join(), /accusations/);

    const judge = parseJudge(
      {
        scores: {
          alpha: {
            fit: {score: 11, evidence: 'short'},
            experience: {score: 5, evidence: 'Opened the page on a 375px screen'},
            craft: {score: 5, evidence: 'npm test shows 12 passing tests'},
          },
        },
      },
      ['alpha', 'beta'],
    );
    assert.match(judge.errors.join('\n'), /0-10/);
    assert.match(judge.errors.join('\n'), /at least 20/);
    assert.match(judge.errors.join('\n'), /no scores for team beta/);
    assert.match(parseJudge([], []).errors.join(), /scores/);
  });
});

describe('safety', () => {
  it('finds secrets and committed .env files', () => {
    const dir = tempDir();
    write(path.join(dir, 'src', 'pay.js'), `const key = "sk_live_${'a'.repeat(24)}";`);
    write(path.join(dir, 'src', 'cfg.js'), `const password = "correct-horse-battery";`);
    write(path.join(dir, '.env'), 'TOKEN=1');
    write(path.join(dir, '.env.example'), 'TOKEN=');
    write(path.join(dir, 'node_modules', 'x.js'), `AKIA${'A'.repeat(16)}`);
    const findings = scanSecrets(dir);
    assert.deepEqual(findings.map(item => [item.file, item.kind, item.blocking]).sort(), [
      ['.env', '.env file committed', true],
      ['src/cfg.js', 'hard-coded credential', false],
      ['src/pay.js', 'Stripe live key', true],
    ]);
  });

  it('checks npm and PyPI dependencies through a lookup', async () => {
    const dir = tempDir();
    writeJsonFile(path.join(dir, 'package.json'), {
      dependencies: {
        express: '^5.0.0',
        'left-padx-ai': '1.0.0',
        local: 'file:../local',
        alias: 'npm:react@19',
        gh: 'user/repo',
      },
      devDependencies: 'bad',
    });
    write(path.join(dir, 'requirements.txt'), '# comment\nrequests==2.32\n-r other.txt\nflaskk\n');
    const known = new Set(['express', 'react', 'requests']);
    const deps = await checkDependencies(dir, {
      lookup: (_ecosystem, name) =>
        Promise.resolve(known.has(name) ? 'exists' : name === 'flaskk' ? 'unknown' : 'missing'),
    });
    assert.deepEqual(
      deps.map(item => `${item.ecosystem}:${item.name}:${item.status}`),
      [
        'npm:express:exists',
        'npm:left-padx-ai:missing',
        'npm:react:exists',
        'pypi:requests:exists',
        'pypi:flaskk:unknown',
      ],
    );
    const offline = await runSafety(dir, {offline: true});
    assert.ok(offline.dependencies.every(item => item.status === 'skipped'));
    assert.equal(offline.clean, true);
    write(path.join(dir, 'package.json'), '{');
    assert.deepEqual(await checkDependencies(dir, {offline: true}), [
      {name: 'requests', ecosystem: 'pypi', status: 'skipped', detail: 'offline mode'},
      {name: 'flaskk', ecosystem: 'pypi', status: 'skipped', detail: 'offline mode'},
    ]);
  });
});

describe('stations and state', () => {
  it('migrates version 1 state', () => {
    const {state, migrated} = parseState({
      version: 1,
      project: 'Old',
      stages: {interview: {status: 'done'}, research: {status: 'done', skipped: true, reason: 'r'}},
    });
    assert.equal(migrated, true);
    assert.equal(state.version, 2);
    assert.equal(state.stations.interview.status, 'done');
    assert.equal(state.stations.research.skipped, true);
    assert.equal(state.stations.hooks.status, 'pending');
    assert.match(state.projectId, /^[a-f0-9-]{36}$/);
    assert.throws(() => parseState({}), /not a Skillsmith state/);
    assert.ok(isStationId('arena') && !isStationId('nope'));
    assert.equal(station('ship').title, 'Ship');
  });
});

describe('gates', () => {
  function stationDir(): string {
    const dir = tempDir();
    write(path.join(dir, '01-brief.md'), briefText());
    write(path.join(dir, '02-research.md'), researchText());
    writeJsonFile(path.join(dir, '02-sources.json'), sourcesData());
    write(path.join(dir, '03-hooks.md'), hooksText());
    write(path.join(dir, '04-screenplay.md'), screenplayText());
    writeJsonFile(path.join(dir, '04-acceptance.json'), acceptanceData());
    return dir;
  }

  it('passes the interview, research and hooks gates on good artifacts', () => {
    const dir = stationDir();
    for (const id of ['interview', 'research', 'hooks'] as const) {
      const result = runGate(id, dir);
      assert.deepEqual(result.errors, [], `${id}: ${result.errors.join('; ')}`);
    }
  });

  it('stops killed, unconfirmed and incomplete briefs', () => {
    const dir = tempDir();
    write(
      path.join(dir, '01-brief.md'),
      briefText({
        verdict: 'KILLED',
        status: 'draft',
        coverage: '- Problem: Missing\n- Audience: Partial',
      }),
    );
    const errors = runGate('interview', dir).errors.join('\n');
    assert.match(errors, /KILLED/);
    assert.match(errors, /not confirmed/);
    assert.match(errors, /"Problem" is Missing/);
    assert.match(errors, /does not rate "Core flow"/);
    assert.match(runGate('interview', tempDir()).errors.join(), /does not exist/);
  });

  it('rejects slop, numbers without sources and unverified citations in hooks', () => {
    const dir = stationDir();
    write(
      path.join(dir, '03-hooks.md'),
      hooksText('3. This game-changer saves 40% [S9].\n4. Saves 12 dollars a month.').replace(
        'Platform: Reddit',
        'Platform: Reddit and X',
      ),
    );
    const errors = runGate('hooks', dir).errors.join('\n');
    assert.match(errors, /slop check failed/);
    assert.match(errors, /\[S9\]/);
    assert.match(errors, /no source tag/);
    assert.match(errors, /exactly one platform/);
  });

  it('requires traceability and a fresh vacuity report for the screenplay', () => {
    const dir = stationDir();
    let errors = runGate('screenplay', dir).errors.join('\n');
    assert.match(errors, /04-vacuity.json does not exist/);
    writeJsonFile(path.join(dir, '04-vacuity.json'), {acceptanceHash: 'old', vacuous: ['A2']});
    errors = runGate('screenplay', dir).errors.join('\n');
    assert.match(errors, /changed after the vacuity check/);
    assert.match(errors, /prove nothing: A2/);
    const data = acceptanceData();
    data['checks'] = (data['checks'] as Array<Record<string, unknown>>).map(check => ({
      ...check,
      covers: ['R1', 'R9'],
    }));
    writeJsonFile(path.join(dir, '04-acceptance.json'), data);
    errors = runGate('screenplay', dir).errors.join('\n');
    assert.match(errors, /requirement R2 has no acceptance check/);
    assert.match(errors, /covers R9/);
    fs.rmSync(path.join(dir, '01-brief.md'));
    assert.match(runGate('screenplay', dir).errors.join(), /requirements cannot be traced/);
  });

  it('checks research sources and the later stations', () => {
    const dir = stationDir();
    write(path.join(dir, '02-research.md'), `${researchText()}\nAlso [S7].`);
    writeJsonFile(path.join(dir, '02-sources.json'), {sources: []});
    const errors = runGate('research', dir).errors.join('\n');
    assert.match(errors, /only 0 verified/);
    assert.match(errors, /\[S7\]/);
    assert.match(runGate('arena', dir).errors.join(), /not started/);
    writeJsonFile(path.join(dir, 'arena.json'), {status: 'running'});
    assert.match(runGate('arena', dir).errors.join(), /no winner/);
    assert.match(runGate('ship', dir).errors.join('\n'), /REPORT.md/);
  });
});
