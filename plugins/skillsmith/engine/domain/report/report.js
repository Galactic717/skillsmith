/** REPORT.md: what happened, in words a founder understands. */
import { writeFileAtomic } from '../../core/fs.js';
import { recordPath } from '../../core/paths.js';
import { nowIso } from '../../core/text.js';
import { CAUSE_TEXT, describeEvent } from '../arena/model.js';
import { STATIONS } from '../stations.js';
import { collectReport } from './collect.js';
const NEXT_STEPS = [
    'Open README.md in your project: it explains how to run the product.',
    'Your launch copy is in .skillsmith/03-hooks.md.',
    'Open .skillsmith/dashboard.html to see the whole story, or run `skillsmith dashboard` to refresh it.',
];
/** Writes `.skillsmith/REPORT.md` and returns its path. */
export function writeReport(project) {
    const data = collectReport(project);
    const { state } = project;
    const lines = [
        `# ${state.project}: Skillsmith report`,
        '',
        `Generated ${nowIso().slice(0, 16).replace('T', ' ')} UTC`,
        '',
    ];
    if (data.summary)
        lines.push('## In one sentence', '', data.summary, '');
    lines.push('| Station | Done | Output |', '|---|---|---|');
    for (const item of STATIONS) {
        const record = state.stations[item.id];
        const mark = record.status === 'done'
            ? record.skipped
                ? `skipped: ${record.reason ?? ''}`
                : 'yes'
            : 'not yet';
        lines.push(`| ${item.title} | ${mark} | ${item.outputs.join(', ')} |`);
    }
    lines.push('');
    lines.push('## Records', '');
    lines.push(data.ledger.ok
        ? `The ledger holds ${data.ledger.entries} signed entries and every one checks out${data.ledger.macChecked ? '' : ' (hash chain only: the signing key is not on this machine)'}.`
        : `The ledger failed its check: ${data.ledger.problems.join('; ')}`);
    if (data.drift.length)
        lines.push('', `Edited after approval: ${data.drift.join(', ')}`);
    if (data.integrityProblem)
        lines.push('', `**Integrity problem:** ${data.integrityProblem}`);
    lines.push('');
    if (data.arena) {
        const arena = data.arena;
        lines.push('## Arena', '');
        if (arena.winner)
            lines.push(`**Winner:** ${arena.winner} (${arena.teams[arena.winner]?.persona ?? ''})`, '');
        if (data.board?.rows.length) {
            lines.push('| Team | Manager | Acceptance | Hidden | Auditor | Total |', '|---|---|---|---|---|---|', ...data.board.rows.map(row => `| ${row.team} | ${row.persona} | ${row.acceptancePts} | ${arena.holdout ? row.holdoutPts : '–'} | ${row.judgePts} | ${row.total} |`), '');
            if (data.board.tooCloseToCall)
                lines.push('The top two finished within 2 points: too close to call.', '');
        }
        lines.push('### Fight log', '', ...arena.events.map(event => `- ${event.at.slice(11, 16)} ${describeEvent(event)}`), '');
    }
    lines.push('## Graveyard', '');
    if (data.graveyard.entries.length === 0)
        lines.push('Nobody has died. Yet.', '');
    for (const entry of data.graveyard.entries) {
        lines.push(`- **${entry.team} (${entry.persona})**: ${CAUSE_TEXT[entry.cause]}. ${entry.evidence.map(item => item.label).join('; ')}`);
    }
    lines.push('', '## What to do next', '', ...NEXT_STEPS.map(step => `- ${step}`), '');
    const file = recordPath(project.root, 'REPORT.md');
    writeFileAtomic(file, lines.join('\n'));
    return file;
}
