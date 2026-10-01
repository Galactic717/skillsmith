/**
 * Helpers for the Markdown artifacts agents write. Sections are marked with
 * `<!-- ss:name -->` anchors so the engine can find them in any language and
 * under any heading text.
 */

const ANCHOR = /<!-- ss:(?!slop-ignore)([a-z0-9-]+) -->/g;
const PLACEHOLDER =
  /(?<![\p{L}])(TBD|TODO|FIXME|XXX)(?![\p{L}])|\?\?\?|\[fill[^\]]*\]|<fill[^>]*>/u;

/** Text between an anchor and the next anchor (or the end). */
export function section(text: string, anchor: string): string {
  const marker = `<!-- ss:${anchor} -->`;
  const start = text.indexOf(marker);
  if (start === -1) return '';
  const rest = text.slice(start + marker.length);
  ANCHOR.lastIndex = 0;
  const next = ANCHOR.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** One error per required anchor that is missing. */
export function anchorErrors(text: string, anchors: readonly string[], file: string): string[] {
  return anchors
    .filter(anchor => !text.includes(`<!-- ss:${anchor} -->`))
    .map(anchor => `${file}: missing section anchor <!-- ss:${anchor} -->`);
}

/** One error per line that still holds a placeholder such as TBD or [fill]. */
export function placeholderErrors(text: string, file: string): string[] {
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (PLACEHOLDER.test(line)) {
      errors.push(`${file}:${index + 1}: unfinished placeholder: ${line.trim().slice(0, 80)}`);
    }
  });
  return errors;
}

/** Non-empty prose lines of a section, without headings and comments. */
export function proseLines(sectionText: string): string[] {
  return sectionText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('<!--'));
}

/** Source ids cited as [S1], [S2] ... in a text, deduplicated. */
export function citedSourceIds(text: string): string[] {
  return [...new Set((text.match(/\[S\d+\]/g) ?? []).map(match => match.slice(1, -1)))];
}
