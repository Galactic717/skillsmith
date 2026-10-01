// Online quote check: does the quoted sentence actually appear on the page?
// A researcher who invents a quote is caught here, not by a reader later.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: '-', ndash: '-', hellip: '...' };

export function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛′ʼ`]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[  -​  　﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findQuote(pageText, quote) {
  const page = normalize(pageText);
  const q = normalize(quote);
  if (q && page.includes(q)) return 'confirmed';
  const words = q.split(' ');
  const min = Math.max(6, Math.ceil(words.length * 0.7));
  for (let len = words.length - 1; len >= min; len -= 1) {
    for (let start = 0; start + len <= words.length; start += 1) {
      if (page.includes(words.slice(start, start + len).join(' '))) return 'partial';
    }
  }
  return 'not-found';
}

export async function verifyQuotes(data, { timeoutMs = 20000, fetchImpl = fetch } = {}) {
  const results = [];
  for (const s of data.sources || []) {
    if (s.status !== 'verified') continue;
    try {
      const res = await fetchImpl(s.url, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (Skillsmith source check)', accept: 'text/html,application/xhtml+xml,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        results.push({ id: s.id, url: s.url, status: 'unreachable', detail: `HTTP ${res.status}` });
        continue;
      }
      const body = await res.text();
      const status = findQuote(stripHtml(body), s.quote);
      results.push({ id: s.id, url: s.url, status, detail: status === 'not-found' ? 'quote not on the page: fix the quote or mark the source unconfirmed' : '' });
    } catch (err) {
      results.push({ id: s.id, url: s.url, status: 'unreachable', detail: err.cause?.code || err.message });
    }
  }
  return results;
}
