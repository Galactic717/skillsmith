/**
 * The founder's brief: requirement ids (R1, R2 ...), measurable success
 * criteria (SC1 ...), the idea-check verdict and the coverage map.
 */
import { proseLines, section } from './markdown.js';
/** Section anchors every brief must have. */
export const BRIEF_ANCHORS = [
    'summary',
    'forge',
    'founder',
    'audience',
    'problem',
    'requirements',
    'success',
    'scope',
    'platform',
    'look',
    'data',
    'money',
    'launch',
    'risks',
    'coverage',
    'assumptions',
];
/**
 * Areas the interviewer must cover, adapted from spec-kit's clarify taxonomy
 * to words a founder uses.
 */
export const COVERAGE_AREAS = [
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
];
const VAGUE_WORDS = [
    'fast',
    'quick',
    'quickly',
    'easy',
    'easily',
    'simple',
    'intuitive',
    'user-friendly',
    'robust',
    'scalable',
    'secure',
    'modern',
    'beautiful',
    'seamless',
    'efficient',
    'reliable',
    'smooth',
    'powerful',
    'flexible',
];
const VAGUE = new RegExp(`(?<![\\p{L}-])(${VAGUE_WORDS.join('|')})(?![\\p{L}-])`, 'iu');
function numberedLines(text, prefix) {
    const pattern = new RegExp(`^\\s*(?:[-*]|\\d+\\.)?\\s*\\**(${prefix}\\d+)\\**\\s*[:.)\\-–]\\s*(.+)$`);
    const lines = [];
    for (const line of text.split(/\r?\n/)) {
        const match = pattern.exec(line);
        if (match?.[1] && match[2])
            lines.push({ id: match[1], text: match[2].trim() });
    }
    return lines;
}
/** Requirements (R#) listed in the "requirements" section. */
export function requirements(brief) {
    return numberedLines(section(brief, 'requirements'), 'R');
}
/** Success criteria (SC#) listed in the "success" section. */
export function successCriteria(brief) {
    return numberedLines(section(brief, 'success'), 'SC');
}
/** The idea-check verdict, if the forge section states one. */
export function forgeVerdict(brief) {
    const match = /verdict\s*[:\-–]\s*\**\s*(HARDENED|CLARIFIED|KILLED)\b/i.exec(section(brief, 'forge'));
    return match?.[1] ? match[1].toUpperCase() : undefined;
}
/** Coverage status per area, as written in the coverage map. */
export function coverageMap(brief) {
    const map = new Map();
    const text = section(brief, 'coverage');
    for (const area of COVERAGE_AREAS) {
        const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^\\s*[-*|]?\\s*\\**${escaped}\\**\\s*[:|]\\s*\\**(Clear|Partial|Missing)\\b`, 'im');
        const match = pattern.exec(text);
        if (match?.[1]) {
            const value = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            map.set(area, value);
        }
    }
    return map;
}
/** The one-sentence summary, flattened to a single line. */
export function oneSentence(brief) {
    return proseLines(section(brief, 'summary')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}
/** Problems and warnings specific to the brief's requirement lists. */
export function requirementFindings(brief) {
    const errors = [];
    const warnings = [];
    const reqs = requirements(brief);
    const criteria = successCriteria(brief);
    if (reqs.length < 3)
        errors.push(`01-brief.md: list at least 3 requirements as "R1: ...", found ${reqs.length}`);
    if (criteria.length < 1)
        errors.push('01-brief.md: list at least 1 success criterion as "SC1: ..."');
    for (const list of [reqs, criteria]) {
        const seen = new Set();
        for (const item of list) {
            if (seen.has(item.id))
                errors.push(`01-brief.md: ${item.id} is listed twice`);
            seen.add(item.id);
        }
    }
    for (const item of reqs) {
        const vague = VAGUE.exec(item.text);
        if (vague && !/\d/.test(item.text)) {
            warnings.push(`01-brief.md: ${item.id} says "${vague[1] ?? ''}" without a number; say how much (e.g. "under 2 seconds")`);
        }
    }
    for (const item of criteria) {
        if (!/\d/.test(item.text)) {
            errors.push(`01-brief.md: ${item.id} is not measurable; give a number and a time frame (e.g. "20 paying users in 30 days")`);
        }
    }
    return { errors, warnings };
}
