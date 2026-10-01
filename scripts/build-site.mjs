#!/usr/bin/env node
// Wraps site/src/page.html (an HTML fragment, also publishable as-is) into
// site/index.html with the document shell and link-preview tags.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://galactic717.github.io/skillsmith';
const body = fs.readFileSync(path.join(ROOT, 'site', 'src', 'page.html'), 'utf8');
const description = 'Free Claude Code plugin: seven AI specialists turn a plain-language idea into a verified product. Three rival teams build it; a script checks every claim; a team that lies is deleted.';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta property="og:title" content="Skillsmith: idea in, verified product out">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${BASE}/media/og.png">
<meta property="og:url" content="${BASE}/">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}/media/og.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='11' fill='%23C94B07'/%3E%3C/svg%3E">
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), html);
console.log('wrote site/index.html');
