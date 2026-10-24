// Restore the exact pre-rewrite values captured in db-rewrite-backup.json.
// Run: node image-work/rehost/db-rollback.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../backend/package.json'));
const postgres = require('postgres');
const envText = readFileSync(resolve(here, '../../backend/.env'), 'utf8');
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?$/m)?.[1];

const plan = JSON.parse(readFileSync(resolve(here, 'db-rewrite-backup.json'), 'utf8'));
const sql = postgres(dbUrl, { max: 1, prepare: false });

await sql.begin(async (tx) => {
  for (const p of plan) {
    if (p.isJson) {
      await tx.unsafe(`update "${p.table}" set "${p.column}" = $1::jsonb where "${p.pkCol}" = $2`, [p.old, p.pk]);
    } else {
      await tx.unsafe(`update "${p.table}" set "${p.column}" = $1 where "${p.pkCol}" = $2`, [p.old, p.pk]);
    }
  }
});
await sql.end();
console.log(`rolled back ${plan.length} rows to their pre-rewrite values`);
