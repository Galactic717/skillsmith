/** Valid station artifacts for the TrialGuard example (Maya's own product). */

/** A brief that passes the interview gate. */
export function briefText(
  overrides: {verdict?: string; coverage?: string; status?: string} = {},
): string {
  const coverage =
    overrides.coverage ??
    [
      'Problem',
      'Audience',
      'Core flow',
      'Data',
      'Platform',
      'Look',
      'Money',
      'Limits',
      'Launch',
      'Risks',
    ]
      .map(area => `- ${area}: Clear`)
      .join('\n');
  return `# Product brief: TrialGuard

Status: ${overrides.status ?? 'confirmed'}
Founder: Maya

<!-- ss:summary -->
## In one sentence

TrialGuard is a small web app that warns people three days before a free trial turns into a paid subscription.

<!-- ss:forge -->
## Idea check

Verdict: ${overrides.verdict ?? 'HARDENED'}

- Strongest objection: banks and phones already show subscriptions, so why would anyone add another app?
- How it was answered: they show charges after they happen; TrialGuard warns before the first charge, which is the moment that matters.
- What would kill it later: fewer than 10 of the first 100 visitors add a trial.

<!-- ss:founder -->
## The founder and the goal

Maya is a designer who builds this on weekends, about six hours a week. Success for her is a side project that pays for itself and a portfolio piece she can show clients.

<!-- ss:audience -->
## Who it is for

Students and young professionals who sign up for free trials of streaming, software and fitness apps and forget to cancel them before the first payment.

<!-- ss:problem -->
## The problem today

People rely on memory or calendar notes. They forget, the trial converts, and they pay for a month they never wanted. Refund requests are slow and often refused.

<!-- ss:requirements -->
## What version one must do

- R1: A visitor can add a trial with a name and an end date and sees it in a list sorted by end date.
- R2: The home page explains the product in one headline and opens in under 2 seconds on a phone.
- R3: The README explains how to run the product on a laptop with one command.

<!-- ss:success -->
## How we will know it works

- SC1: 30 people add at least one trial in the first 14 days after launch.

<!-- ss:scope -->
## Not in version one

- Email reminders, bank connections and a mobile app are later. We never ask for card numbers.

<!-- ss:platform -->
## Where it runs

A website that works on phones and laptops. No accounts in version one; data stays in the browser.

<!-- ss:look -->
## Look and feel

Calm, clear, trustworthy. Maya likes Linear and Things. She hates dark patterns and countdown banners.

<!-- ss:data -->
## Data and privacy

Trial names and dates stay in the visitor's browser. Nothing personal leaves the device.

<!-- ss:money -->
## Money

Free in version one. Hosting must stay under 5 dollars a month.

<!-- ss:launch -->
## Launch

Reddit communities about personal finance, where people already complain about forgotten trials.

<!-- ss:risks -->
## Risks

Browsers can clear local data; people may not come back to the site without email reminders.

<!-- ss:coverage -->
## Coverage map

${coverage}

<!-- ss:assumptions -->
## Assumptions waiting for the founder's yes

- Three days of warning is enough for most people to cancel.
`;
}

/** Research that passes the research gate when paired with sourcesData(). */
export function researchText(): string {
  return `# Research: TrialGuard

<!-- ss:competitors -->
## Competitors
Subscription trackers exist [S1] [S2].

<!-- ss:audience -->
## Audience and their pain
People forget trials [S3].

<!-- ss:trends -->
## Trends
1. Regulators push for easier cancellation [S4].

<!-- ss:niches -->
## Open niches
1. Warnings before the first charge [S5].

<!-- ss:repos -->
## Repositories worth using or studying
- https://github.com/example/trial-reminder, MIT, idea for date handling.

<!-- ss:implications -->
## What this means for the product
1. Warn before the charge, not after.

<!-- ss:rejected -->
## Rejected
- A claim about a percentage we could not verify.
`;
}

/** Sources with five verified entries. */
export function sourcesData(): unknown {
  return {
    sources: [1, 2, 3, 4, 5].map(index => ({
      id: `S${index}`,
      title: `Source ${index}`,
      url: `https://example.com/source-${index}`,
      quote: `An exact quoted sentence number ${index} from the page.`,
      claim: 'Supports a statement in the research.',
      accessed: '2026-10-01',
      status: 'verified',
    })),
    rejected: [],
  };
}

/** Hooks copy that passes the hooks gate. */
export function hooksText(extra = ''): string {
  return `# Hooks: TrialGuard

<!-- ss:platform -->
## Main platform

Platform: Reddit

People there already post about forgotten trials.

<!-- ss:oneliner -->
## One line

Never pay for a forgotten free trial again.

<!-- ss:hooks -->
## Hooks, strongest first

1. I paid 3 subscriptions I forgot to cancel last year [P].
2. Add a trial in ten seconds and get warned three days before it charges [P].
${extra}

<!-- ss:launch-post -->
## Launch post

I built a tiny site that warns you three days before a free trial charges your card. It keeps everything in your browser.

<!-- ss:kill-list -->
## Cut, and why

<!-- ss:slop-ignore -->
- "A game-changer for your wallet": hype, no fact.
<!-- /ss:slop-ignore -->
`;
}

/** A screenplay that mentions A1-A3. */
export function screenplayText(): string {
  return `# Screenplay: TrialGuard

<!-- ss:logline -->
## Logline
Maya wants people to stop paying for forgotten trials.

<!-- ss:cast -->
## Cast
- Protagonist: Sam, a student with four trials.

<!-- ss:world -->
## World
A static site with a tiny Node server.

<!-- ss:act1 -->
## Act I
### Scene 1.1: "First trial"
- Acceptance: A1

<!-- ss:act2 -->
## Act II
### Scene 2.1: "Home page"
- Acceptance: A2

<!-- ss:act3 -->
## Act III
### Scene 3.1: "Readme"
- Acceptance: A3

<!-- ss:acceptance -->
## Acceptance checks
See 04-acceptance.json.
`;
}

/** Acceptance checks for a tiny product made of app.mjs and README.md. */
export function acceptanceData(): Record<string, unknown> {
  return {
    version: 2,
    setup: [],
    protected: ['tests/acceptance/**'],
    checks: [
      {
        id: 'A1',
        title: 'Adding a trial lists it',
        covers: ['R1'],
        type: 'command',
        run: 'node tests/acceptance/add.mjs',
        expect: {includes: 'listed: Netflix'},
      },
      {
        id: 'A2',
        title: 'The app prints the headline',
        covers: ['R2'],
        type: 'command',
        run: 'node app.mjs headline',
        expect: {includes: 'Never pay for a forgotten trial'},
      },
      {
        id: 'A3',
        title: 'README says how to run it',
        covers: ['R3'],
        type: 'file_contains',
        path: 'README.md',
        pattern: 'node app.mjs',
      },
      {
        id: 'A4',
        title: 'No live keys',
        covers: ['R3'],
        type: 'not_contains',
        glob: '**/*.mjs',
        pattern: 'sk_live_',
        guard: true,
      },
    ],
  };
}

/** The committed acceptance test script used by A1. */
export const ACCEPTANCE_SCRIPT = `import {spawnSync} from 'node:child_process';
const result = spawnSync(process.execPath, ['app.mjs', 'add', 'Netflix', '2026-10-20'], {encoding: 'utf8'});
process.stdout.write(result.stdout);
process.exit(result.status ?? 1);
`;

/** A complete product that passes A1-A4 and the holdout. */
export const GOOD_APP = `const [command, name, date] = process.argv.slice(2);
if (command === 'headline') console.log('Never pay for a forgotten trial');
if (command === 'add') {
  if (new Date(date) < new Date('2026-01-01')) { console.log('rejected: end date is in the past'); process.exit(1); }
  console.log('listed: ' + name + ' ends ' + date);
}
`;

/** A weaker product: passes A1 and A2 but accepts past dates. */
export const WEAK_APP = `const [command, name, date] = process.argv.slice(2);
if (command === 'headline') console.log('Never pay for a forgotten trial');
if (command === 'add') console.log('listed: ' + name + ' ends ' + date);
`;

/** Hidden checks: a past end date must be rejected. */
export function holdoutData(): unknown {
  return {
    files: {
      'tests/holdout/past.mjs': `import {spawnSync} from 'node:child_process';
const result = spawnSync(process.execPath, ['app.mjs', 'add', 'Old', '2020-01-01'], {encoding: 'utf8'});
if (result.stdout.includes('rejected')) { console.log('ok'); } else { console.log('accepted a past date'); process.exit(1); }
`,
    },
    checks: [
      {
        id: 'H1',
        title: 'A past end date is rejected',
        covers: ['R1'],
        type: 'command',
        run: 'node tests/holdout/past.mjs',
      },
    ],
  };
}
