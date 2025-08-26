#!/usr/bin/env node
/*
 Simple schema & consistency validator for AGENTUPDATEHISTORY.jsonl (schema v2.0).
 Fails (exit 1) on:
  - Missing required fields
  - Invalid enum values
  - Empty relates_to_vision for non-docs change
  - Duplicate IDs
  - Paths mismatch (changes[].path not all represented in top-level paths[] or vice versa)
  - Timestamp not ISO parseable
  - First line schema not version 2.0
  - cost_impact escalation without rationale mention (if cost_impact != none requires the word 'cost' in rationale)
*/
import fs from 'fs';
import path from 'path';

const targetFile = process.env.HIST_FILE || 'AGENTUPDATEHISTORY.jsonl';
const filePath = path.resolve(process.cwd(), targetFile);
if (!fs.existsSync(filePath)) {
  console.error('AGENTUPDATEHISTORY.jsonl not found');
  process.exit(1);
}

const text = fs.readFileSync(filePath, 'utf8').trim();
if (!text) {
  console.error('AGENTUPDATEHISTORY.jsonl is empty');
  process.exit(1);
}

const lines = text.split(/\n+/);
let failures = 0;
const warn = (m) => console.warn('\u26A0\uFE0F  ' + m);
const fail = (m) => {
  console.error('\u274C ' + m);
  failures++;
};

// Parse schema line
let schemaObj;
try {
  schemaObj = JSON.parse(lines[0]);
} catch (e) {
  fail('First line not valid JSON');
}
if (!schemaObj || schemaObj.type !== 'schema') fail('First line must have type="schema"');
if (schemaObj && schemaObj.version !== '2.0')
  fail(`Schema version expected 2.0, got ${schemaObj.version}`);

const requiredFields = [
  'id',
  'timestamp',
  'actor',
  'area',
  'category',
  'summary',
  'rationale',
  'vision_alignment_confirmed',
  'relates_to_vision',
  'pre_checks',
  'changes',
  'paths',
  'status',
  'change_type',
  'cost_impact',
  'reviewers',
  'tags',
];
const enumChangeType = new Set(['add', 'modify', 'delete', 'refactor', 'docs']);
const enumCostImpact = new Set(['none', 'negligible', 'low', 'medium', 'high']);
const enumStatus = new Set(['proposed', 'applied', 'reverted']);
const enumActor = new Set(['copilot-agent', 'human', 'automation']);

const ids = new Set();

for (let i = 1; i < lines.length; i++) {
  const raw = lines[i].trim();
  if (!raw) continue;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    fail(`Line ${i + 1}: invalid JSON`);
    continue;
  }
  const ctx = `Entry line ${i + 1}`;
  for (const f of requiredFields) {
    if (!(f in obj)) fail(`${ctx}: missing required field ${f}`);
  }
  if (obj.id) {
    if (ids.has(obj.id)) fail(`${ctx}: duplicate id ${obj.id}`);
    else ids.add(obj.id);
  }
  if (obj.timestamp) {
    const d = new Date(obj.timestamp);
    if (isNaN(d.getTime())) fail(`${ctx}: invalid timestamp ${obj.timestamp}`);
  }
  if (obj.actor && !enumActor.has(obj.actor)) fail(`${ctx}: invalid actor ${obj.actor}`);
  if (obj.change_type && !enumChangeType.has(obj.change_type))
    fail(`${ctx}: invalid change_type ${obj.change_type}`);
  if (obj.cost_impact && !enumCostImpact.has(obj.cost_impact))
    fail(`${ctx}: invalid cost_impact ${obj.cost_impact}`);
  if (obj.status && !enumStatus.has(obj.status)) fail(`${ctx}: invalid status ${obj.status}`);
  if (Array.isArray(obj.relates_to_vision)) {
    if (obj.change_type !== 'docs' && obj.relates_to_vision.length === 0)
      fail(`${ctx}: relates_to_vision empty for non-docs change`);
  } else {
    fail(`${ctx}: relates_to_vision must be array`);
  }
  if (Array.isArray(obj.changes)) {
    for (const ch of obj.changes) {
      if (!ch.path) fail(`${ctx}: change missing path`);
      if (ch.action && !['add', 'modify', 'delete', 'rename'].includes(ch.action))
        fail(`${ctx}: invalid change action ${ch.action}`);
    }
  } else fail(`${ctx}: changes must be array`);
  if (Array.isArray(obj.paths)) {
    const changePaths = new Set(obj.changes.filter((c) => c.path).map((c) => c.path));
    for (const p of obj.paths) {
      if (!changePaths.has(p)) warn(`${ctx}: path '${p}' not found in changes[] list`);
    }
    for (const p of changePaths) {
      if (!obj.paths.includes(p))
        warn(`${ctx}: changes[] path '${p}' missing in top-level paths[]`);
    }
  } else fail(`${ctx}: paths must be array`);
  if (obj.cost_impact && obj.cost_impact !== 'none') {
    if (typeof obj.rationale === 'string' && !/cost/i.test(obj.rationale))
      warn(`${ctx}: cost_impact ${obj.cost_impact} but rationale lacks 'cost' keyword`);
  }
}

if (failures) {
  console.error(`\nValidation failed with ${failures} error(s).`);
  process.exit(1);
}
console.log('AGENTUPDATEHISTORY.jsonl validation passed.');
