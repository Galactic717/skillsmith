/**
 * Error types with stable exit codes. The CLI maps them to process exit
 * codes so agents and CI can branch on them without parsing text.
 */

/** Exit codes, documented in docs/architecture.md. */
export const EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  unexpected: 3,
  integrity: 4,
} as const;

/** A problem the user or an agent can fix; printed without a stack trace. */
export class SkillsmithError extends Error {
  readonly exitCode: number;
  readonly hint: string | undefined;

  constructor(message: string, options: {hint?: string; exitCode?: number} = {}) {
    super(message);
    this.name = 'SkillsmithError';
    this.exitCode = options.exitCode ?? EXIT.failed;
    this.hint = options.hint;
  }
}

/** The command was called wrongly. */
export class UsageError extends SkillsmithError {
  constructor(message: string, hint?: string) {
    super(message, {exitCode: EXIT.usage, ...(hint === undefined ? {} : {hint})});
    this.name = 'UsageError';
  }
}

/** Records were modified outside the engine, or cannot be trusted. */
export class IntegrityError extends SkillsmithError {
  constructor(message: string, hint?: string) {
    super(message, {exitCode: EXIT.integrity, ...(hint === undefined ? {} : {hint})});
    this.name = 'IntegrityError';
  }
}

/** Returns a readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
