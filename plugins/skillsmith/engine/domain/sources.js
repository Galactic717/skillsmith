/**
 * Research sources: shape validation and the online quote check. A
 * researcher who invents a quote is caught here, not by a reader later.
 */
import { isRecord, isText } from '../core/json.js';
const STATUSES = ['verified', 'unconfirmed', 'rejected'];
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MIN_QUOTE_CHARS = 15;
/** Validates the shape of 02-sources.json. */
export function validateSources(value) {
    const errors = [];
    const warnings = [];
    if (!isRecord(value) || !Array.isArray(value['sources'])) {
        return { errors: ['sources file needs a "sources" array'], warnings, ids: [], verified: [] };
    }
    const ids = new Set();
    const verified = [];
    value['sources'].forEach((item, index) => {
        const id = isRecord(item) && typeof item['id'] === 'string' ? item['id'] : undefined;
        const where = `sources[${index}]${id ? ` (${id})` : ''}`;
        if (!isRecord(item)) {
            errors.push(`${where}: must be an object`);
            return;
        }
        if (!id || !/^S\d+$/.test(id))
            errors.push(`${where}: id must look like S1, S2, ...`);
        else if (ids.has(id))
            errors.push(`${where}: duplicate id`);
        else
            ids.add(id);
        const url = item['url'];
        if (typeof url !== 'string' || !/^https?:\/\/\S+$/.test(url))
            errors.push(`${where}: needs a full http(s) url`);
        else if (url.startsWith('http://'))
            warnings.push(`${where}: prefer the https address`);
        if (!isText(item['title']))
            errors.push(`${where}: needs a title`);
        const status = item['status'];
        if (typeof status !== 'string' || !STATUSES.includes(status)) {
            errors.push(`${where}: status must be verified, unconfirmed or rejected`);
        }
        if (status === 'verified') {
            const quote = item['quote'];
            if (typeof quote !== 'string' || quote.trim().length < MIN_QUOTE_CHARS) {
                errors.push(`${where}: a verified source needs an exact quote of at least ${MIN_QUOTE_CHARS} characters`);
            }
            if (!isText(item['claim']))
                errors.push(`${where}: say which claim this source supports`);
            if (!isText(item['accessed']))
                warnings.push(`${where}: add "accessed" (YYYY-MM-DD)`);
            if (id)
                verified.push(id);
        }
    });
    if (!Array.isArray(value['rejected'])) {
        warnings.push('add a "rejected" list (claims you could not verify), even if it is empty');
    }
    return { errors, warnings, ids: [...ids], verified };
}
const ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    mdash: '-',
    ndash: '-',
    hellip: '...',
};
/** Reduces an HTML page to its visible text. */
export function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
        .replace(/&([a-z]+);/gi, (entity, name) => ENTITIES[name.toLowerCase()] ?? entity);
}
/** Lower-cases and unifies quotes, dashes and spaces for fuzzy matching. */
export function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[\u2018\u2019\u201a\u201b\u2032\u02bc`]/g, "'")
        .replace(/[\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb]/g, '"')
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Looks for a quote in page text: "confirmed" for an exact (normalised)
 * match, "partial" when a run of at least 70% of its words (minimum 6) is
 * present.
 */
export function findQuote(pageText, quote) {
    const page = normalizeText(pageText);
    const wanted = normalizeText(quote);
    if (wanted && page.includes(wanted))
        return 'confirmed';
    const words = wanted.split(' ');
    const minimum = Math.max(6, Math.ceil(words.length * 0.7));
    for (let length = words.length - 1; length >= minimum; length -= 1) {
        for (let start = 0; start + length <= words.length; start += 1) {
            if (page.includes(words.slice(start, start + length).join(' ')))
                return 'partial';
        }
    }
    return 'not-found';
}
async function readCapped(response) {
    if (!response.body)
        return '';
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done || !value)
            break;
        size += value.byteLength;
        chunks.push(value);
        if (size >= MAX_PAGE_BYTES) {
            await reader.cancel();
            break;
        }
    }
    return Buffer.concat(chunks).toString('utf8');
}
/** Fetches every verified source and looks for its quote on the page. */
export async function verifyQuotes(value, options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? 20_000;
    const results = [];
    const sources = isRecord(value) && Array.isArray(value['sources']) ? value['sources'] : [];
    for (const item of sources) {
        if (!isRecord(item) || item['status'] !== 'verified')
            continue;
        const id = String(item['id']);
        const url = String(item['url']);
        const quote = typeof item['quote'] === 'string' ? item['quote'] : '';
        if (!/^https?:\/\//.test(url)) {
            results.push({ id, url, status: 'unreachable', detail: 'only http(s) addresses are fetched' });
            continue;
        }
        try {
            const response = await fetchImpl(url, {
                redirect: 'follow',
                headers: {
                    'user-agent': 'Mozilla/5.0 (Skillsmith source check; +https://github.com/galactic717/skillsmith)',
                    accept: 'text/html,application/xhtml+xml,*/*',
                },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!response.ok) {
                results.push({ id, url, status: 'unreachable', detail: `HTTP ${response.status}` });
                continue;
            }
            const status = findQuote(stripHtml(await readCapped(response)), quote);
            const detail = status === 'not-found'
                ? 'quote not on the page: fix the quote or mark the source unconfirmed'
                : '';
            results.push({ id, url, status, detail });
        }
        catch (error) {
            const cause = error instanceof Error && isRecord(error.cause) ? error.cause['code'] : undefined;
            results.push({
                id,
                url,
                status: 'unreachable',
                detail: typeof cause === 'string'
                    ? cause
                    : error instanceof Error
                        ? error.message
                        : String(error),
            });
        }
    }
    return results;
}
