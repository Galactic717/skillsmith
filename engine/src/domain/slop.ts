/**
 * AI-slop detector for English copy: phrases that make readers stop trusting
 * a text. Weight 3 fails on its own; weights 1-2 add up to a density score
 * per 100 words.
 */
import {countWords} from '../core/text.js';

/** One phrase found in a text. */
export interface SlopFinding {
  /** 1-based line; 0 for whole-text findings such as dash counts. */
  line: number;
  col: number;
  match: string;
  weight: number;
  hint: string;
}

/** Detector result. */
export interface SlopReport {
  pass: boolean;
  words: number;
  total: number;
  density: number;
  maxDensity: number;
  hard: number;
  findings: SlopFinding[];
}

type Rule = readonly [pattern: RegExp, weight: number, hint: string];

const RULES: readonly Rule[] = [
  [/delv(e|es|ed|ing)/, 3, 'Say the specific thing instead of "delving".'],
  [/tapestry/, 3, 'Metaphor with no content. Name the actual parts.'],
  [
    /in today'?s (fast-paced|digital|ever-changing|modern|competitive) (world|landscape|age|era|market)/,
    3,
    'Empty opener. Start with the fact or the problem.',
  ],
  [/game[- ]chang(er|ers|ing)/, 3, 'Show the change with a number or an example.'],
  [/revolutioni[sz](e|es|ed|ing)/, 3, 'Say what changes, for whom, by how much.'],
  [
    /unlock (the |your )?(full |true )?(power|potential)/,
    3,
    'Say what the reader can do afterwards.',
  ],
  [/harness(ing)? the power/, 3, 'Name the capability directly.'],
  [/embark(ing)? on (a|an|your|this) .{0,20}journey/, 3, 'Cut the journey. Say the first step.'],
  [/look no further/, 3, 'Ad cliché. Cut it.'],
  [/buckle up/, 3, 'Cut it.'],
  [/imagine a world/, 3, 'Describe the real situation instead.'],
  [/this changes everything/, 3, 'Say exactly what changes.'],
  [/ever[- ](evolving|changing) (landscape|world)/, 2, 'Name what actually changed.'],
  [/unleash(es|ed|ing)?/, 2, 'Say what it does.'],
  [/seamless(ly)?/, 2, 'Nothing is seamless. Say which step disappears.'],
  [/elevate (your|the|their)/, 2, 'Say what gets better and how you measure it.'],
  [/cutting[- ]edge|state[- ]of[- ]the[- ]art/, 2, 'Name the technique or the result.'],
  [/navigat(e|es|ing) the (complexities|landscape|world|maze)/, 2, 'Name the hard part.'],
  [
    /it'?s (important|worth) (to note|noting)|it is (important|worth) (to note|noting)/,
    2,
    'If it matters, just say it.',
  ],
  [/plethora|myriad/, 2, 'Give the number.'],
  [/(in )?the realm of/, 2, 'Name the field.'],
  [/paradigm shift/, 2, 'Describe before and after.'],
  [/synerg(y|ies|istic)/, 2, 'Say who does what together.'],
  [/supercharg(e|es|ed|ing)/, 2, 'Give the before/after number.'],
  [/next[- ]level/, 2, 'Say what level, measured how.'],
  [/whether you'?re an? .{1,40} or an? /, 2, 'Pick one reader and talk to them.'],
  [
    /(not|isn'?t) just (an? |the )?[a-z]+( [a-z]+)?[,;:—–-]+ ?(it'?s|but|this is|they'?re|we'?re)/,
    2,
    '"Not just X, it\'s Y" is a known AI pattern. State Y.',
  ],
  [/let'?s dive (in|into)|dive (deep )?into|deep[- ]dive/, 2, 'Just start.'],
  [/say goodbye to/, 2, 'Ad cliché.'],
  [/best[- ]in[- ]class|world[- ]class/, 2, 'Unprovable. Show evidence.'],
  [/transformative|unparalleled/, 2, 'Show the effect instead.'],
  [/innovative solution/, 2, 'Name the solution.'],
  [/(a|is a) testament to/, 2, 'Say what it proves.'],
  [/in a world where/, 2, 'Describe the real situation.'],
  [/here'?s why (that|this|it) matters/, 2, 'Say why directly.'],
  [/let'?s be honest/, 2, 'Just be honest.'],
  [/in conclusion|to sum up|in summary/, 1, 'Readers know it is the end.'],
  [/moreover|furthermore/, 1, 'Usually removable.'],
  [/empower(s|ed|ing)?/, 1, 'Say what the person can now do.'],
  [
    /meticulous(ly)?|intricate|pivotal|bustling|vibrant|nestled|boasts/,
    1,
    'Decorative word. Replace with a fact.',
  ],
  [/holistic|streamlin(e|es|ed|ing)/, 1, 'Say which steps are removed.'],
  [/leverag(e|es|ed|ing)|foster(s|ed|ing)?|underscor(e|es|ed|ing)/, 1, 'Use a plain verb.'],
  [/crucial|comprehensive|robust/, 1, 'Show it instead of labelling it.'],
  [/here'?s the thing|at the end of the day/, 1, 'Filler.'],
  [/(the best part|the kicker|the catch|the result)\?/, 1, 'Fake suspense. Just say it.'],
];

const COMPILED = RULES.map(([pattern, weight, hint]) => ({
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern.source})(?![\\p{L}\\p{N}])`, 'giu'),
  weight,
  hint,
}));

const HYPE_EMOJI = /[\u{1F680}\u{2728}\u{1F525}\u{1F4A1}\u{1F3AF}\u{1F4AF}\u{1F64C}\u{26A1}]/gu;

/** Default allowed density of weighted findings per 100 words. */
export const DEFAULT_MAX_DENSITY = 1.5;

/**
 * Blanks out code fences, `<!-- ss:slop-ignore -->` regions, comments and
 * inline code, keeping line numbers. Inline code marks a mention ("we ban
 * `game-changer`"), not copy.
 */
function maskIgnored(text: string): string[] {
  let inFence = false;
  let inIgnore = false;
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      return '';
    }
    if (trimmed.includes('<!-- ss:slop-ignore -->')) {
      inIgnore = true;
      return '';
    }
    if (trimmed.includes('<!-- /ss:slop-ignore -->')) {
      inIgnore = false;
      return '';
    }
    if (inFence || inIgnore) return '';
    return line.replace(/<!--.*?-->/g, '').replace(/`[^`\n]*`/g, '');
  });
}

/** Scans English copy for slop. */
export function detectSlop(text: string, maxDensity = DEFAULT_MAX_DENSITY): SlopReport {
  const lines = maskIgnored(text);
  const findings: SlopFinding[] = [];
  lines.forEach((line, index) => {
    for (const rule of COMPILED) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(line)) !== null) {
        findings.push({
          line: index + 1,
          col: match.index + 1,
          match: match[0],
          weight: rule.weight,
          hint: rule.hint,
        });
      }
    }
  });

  const body = lines.join('\n');
  const words = countWords(body);
  const letters = body.match(/\p{L}/gu)?.length ?? 0;
  const latin = body.match(/\p{Script=Latin}/gu)?.length ?? 0;
  const mostlyLatin = letters > 0 && latin / letters > 0.5;
  if (mostlyLatin && words > 0) {
    const dashes = body.match(/—/g)?.length ?? 0;
    if (dashes > Math.max(2, words / 80)) {
      findings.push({
        line: 0,
        col: 0,
        match: `${dashes} em dashes`,
        weight: 2,
        hint: 'Em dashes everywhere read as machine-written. Use periods and commas.',
      });
    }
  }
  const bangs = body.match(/!/g)?.length ?? 0;
  if (words > 0 && bangs > Math.max(2, words / 50)) {
    findings.push({
      line: 0,
      col: 0,
      match: `${bangs} exclamation marks`,
      weight: 1,
      hint: 'Let the facts carry the energy.',
    });
  }
  const emoji = body.match(HYPE_EMOJI)?.length ?? 0;
  if (emoji > 2) {
    findings.push({
      line: 0,
      col: 0,
      match: `${emoji} hype emoji`,
      weight: 1,
      hint: 'Rockets and sparkles are the uniform of AI posts.',
    });
  }

  const total = findings.reduce((sum, finding) => sum + finding.weight, 0);
  const density = words ? (total / words) * 100 : 0;
  const hard = findings.filter(finding => finding.weight >= 3).length;
  return {
    pass: hard === 0 && density <= maxDensity,
    words,
    total,
    density: Math.round(density * 100) / 100,
    maxDensity,
    hard,
    findings,
  };
}
