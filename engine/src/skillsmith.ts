#!/usr/bin/env node
/**
 * Skillsmith engine entry point. Agents call it; it never takes an agent's
 * word for anything. Requires Node.js 20 or newer and git.
 */
import {processContext, run} from './cli/main.js';

process.exitCode = await run(process.argv.slice(2), processContext(import.meta.url));
