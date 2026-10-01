/**
 * Runtime shape checks for JSON written by agents. Each validator returns a
 * list of plain-language problems instead of throwing, so a gate can report
 * every problem at once.
 */

export type JsonRecord = Record<string, unknown>;

/** True for plain objects (not arrays, not null). */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for strings with at least one non-space character. */
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True for arrays whose items are all non-empty strings. */
export function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText);
}

/** Reads a string field or returns undefined. */
export function textField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** Reads a finite number field or returns undefined. */
export function numberField(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Lists keys of `record` that are not in `allowed`. */
export function unknownKeys(record: JsonRecord, allowed: readonly string[]): string[] {
  return Object.keys(record).filter(key => !allowed.includes(key));
}

/**
 * Serialises a value with sorted object keys, so two equal values always
 * produce the same bytes (used for hashing ledger entries).
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
