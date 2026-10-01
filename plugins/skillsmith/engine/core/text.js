/** Small text helpers shared by the detectors and the reports. */
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
/** Counts words in any script. */
export function countWords(text) {
    return text.match(WORD)?.length ?? 0;
}
/**
 * Shortens long output but keeps both ends: errors are usually named at the
 * start and land at the end.
 */
export function clip(text, maxChars = 600) {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars)
        return trimmed;
    const half = Math.floor(maxChars / 2);
    return `${trimmed.slice(0, half).trimEnd()}\n  …\n${trimmed.slice(-half).trimStart()}`;
}
/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch);
}
const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
/** ISO timestamp without milliseconds, UTC. */
export function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
