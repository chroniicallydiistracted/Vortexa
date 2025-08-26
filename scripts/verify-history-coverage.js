#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Ensures that if certain directories changed, an AGENTUPDATEHISTORY entry exists in last commit range.
// Usage: node scripts/verify-history-coverage.js [baseSHA] [headSHA]
// Defaults to HEAD~1..HEAD.

const base = process.argv[2] || process.env.BASE_SHA || 'HEAD~1';
const head = process.argv[3] || process.env.HEAD_SHA || 'HEAD';
const diff = run(`git diff --name-only ${base} ${head}`).split('\n').filter(Boolean);
const watchedPrefixes = ['services/proxy/', 'services/alerts/', 'infra/terraform/', 'web/src/'];
const requiresEntry = diff.some((f) => watchedPrefixes.some((p) => f.startsWith(p)));
if (!requiresEntry) {
  process.exit(0);
}
const historyPath = path.join(process.cwd(), 'AGENTUPDATEHISTORY.jsonl');
if (!fs.existsSync(historyPath)) {
  console.error('AGENTUPDATEHISTORY.jsonl missing');
  process.exit(1);
}
const recent = run(`git log -n 20 --pretty=format:%H`).split('\n');
const historyLines = fs.readFileSync(historyPath, 'utf8').trim().split('\n').slice(-20);
let ok = false;
for (const line of historyLines) {
  try {
    const obj = JSON.parse(line);
    if (obj.timestamp && obj.area && obj.summary) {
      ok = true;
      break;
    }
  } catch {
    /* ignore */
  }
}
if (!ok) {
  console.error('No recent AGENTUPDATEHISTORY entry found for code changes; add one.');
  process.exit(2);
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}
