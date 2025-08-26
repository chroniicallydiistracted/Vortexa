#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'data', 'source-inventory.schema.json');
const dataPath = path.join(root, 'data', 'source-inventory.json');

async function main() {
  const [schemaRaw, dataRaw] = await Promise.all([
    fs.readFile(schemaPath, 'utf8'),
    fs.readFile(dataPath, 'utf8'),
  ]);
  const schema = JSON.parse(schemaRaw);
  const data = JSON.parse(dataRaw);
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    console.error('source-inventory validation failed');
    for (const err of validate.errors || []) {
      console.error(`  ${err.instancePath} ${err.message}`);
    }
    process.exit(1);
  }
  console.log('source-inventory validation passed with no errors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
