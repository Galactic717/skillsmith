/**
 * Minimal glob matching: `**`, `*`, `?` and `{a,b}`. Patterns are relative to
 * the project root, like minimatch without the `matchBase` option.
 */
import { toPosix } from './fs.js';
const cache = new Map();
function escapeRegExp(text) {
    return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}
function globSource(glob) {
    let source = '';
    let index = 0;
    while (index < glob.length) {
        const char = glob[index];
        if (char === '*') {
            if (glob[index + 1] === '*') {
                if (glob[index + 2] === '/') {
                    source += '(?:.*/)?';
                    index += 3;
                }
                else {
                    source += '.*';
                    index += 2;
                }
                continue;
            }
            source += '[^/]*';
            index += 1;
            continue;
        }
        if (char === '?') {
            source += '[^/]';
            index += 1;
            continue;
        }
        if (char === '{') {
            const end = glob.indexOf('}', index);
            if (end > index) {
                const parts = glob
                    .slice(index + 1, end)
                    .split(',')
                    .map(globSource);
                source += `(?:${parts.join('|')})`;
                index = end + 1;
                continue;
            }
        }
        source += escapeRegExp(char ?? '');
        index += 1;
    }
    return source;
}
/** Compiles a glob to an anchored regular expression. */
export function globToRegExp(glob) {
    const normalized = toPosix(glob).replace(/^\.\//, '');
    let compiled = cache.get(normalized);
    if (!compiled) {
        compiled = new RegExp(`^${globSource(normalized)}$`);
        cache.set(normalized, compiled);
    }
    return compiled;
}
/** True when the relative path matches the glob. */
export function matchGlob(relativePath, glob) {
    return globToRegExp(glob).test(toPosix(relativePath));
}
/** True when the relative path matches any of the globs. */
export function matchAny(relativePath, globs) {
    return globs.some(glob => matchGlob(relativePath, glob));
}
