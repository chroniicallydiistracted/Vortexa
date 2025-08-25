#!/usr/bin/env node
import { globby } from 'globby';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MAP = [
  { test: /(\.\.\/)+services\/proxy\/src\//g, replace: '@proxy/' },
  { test: /(\.\.\/)+services\/alerts\/src\//g, replace: '@alerts/' },
  { test: /(\.\.\/)+services\/shared\/src\//g, replace: '@shared/' }
];

const FILE_GLOBS = [
  'web/src/**/*.{ts,tsx,js,jsx}',
  'services/**/src/**/*.{ts,tsx,js,jsx}',
  '!**/node_modules/**',
  '!**/dist/**'
];

const files = await globby(FILE_GLOBS, { gitignore: true });
let changed = 0;
for (const file of files) {
  const abs = path.resolve(ROOT, file);
  const src = await fs.readFile(abs, 'utf8');
  let out = src;
  out = out.replace(/(import\s+[^'"\n]+from\s+['"][^'"]+['"]\s*;?|export\s+\*\s+from\s+['"][^'"]+['"]\s*;?)/g, stmt => {
    let s = stmt;
    for (const rule of MAP) s = s.replace(rule.test, rule.replace);
    return s;
  });
  if (out !== src) {
    await fs.writeFile(abs, out, 'utf8');
    changed++;
  }
}
console.log(`Alias codemod complete. Files updated: ${changed}`);
