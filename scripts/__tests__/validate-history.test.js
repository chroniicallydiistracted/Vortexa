import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

describe('validate-history script', () => {
  it('passes on current history file', () => {
    const out = execSync('node scripts/validate-history.js', { cwd: root }).toString();
    expect(out).toMatch(/validation passed/i);
  });

  it('fails when required field removed', () => {
    const original = fs.readFileSync(path.join(root,'AGENTUPDATEHISTORY.jsonl'),'utf8').split(/\n+/);
    const bad = [...original];
    // Remove a required field (change_type) from the second real entry we find
    // Parse last entry JSON and delete change_type to ensure invalid
    for(let i=bad.length-1;i>0;i--){
      try { const obj = JSON.parse(bad[i]); if(obj.change_type){ delete obj.change_type; bad[i] = JSON.stringify(obj); break; } } catch { /* skip non-json lines */ }
    }
    const tmpName = 'AGENTUPDATEHISTORY_bad.jsonl';
    const tmp = path.join(root,tmpName);
    fs.writeFileSync(tmp, bad.join('\n'));
    let failed = false;
    try {
      execSync('node scripts/validate-history.js', { cwd: root, env: { ...process.env, HIST_FILE: tmpName } });
    } catch { failed = true; }
    fs.unlinkSync(tmp);
    expect(failed).toBe(true);
  });
});