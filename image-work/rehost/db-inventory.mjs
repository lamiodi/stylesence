// Scan every text/json column in the prod DB for Cloudinary URLs.
// Run from repo root with backend's node_modules: node image-work/rehost/db-inventory.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../../backend/package.json'));
const postgres = require('postgres');

const envText = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../backend/.env'), 'utf8');
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?$/m)?.[1];
if (!dbUrl) throw new Error('DATABASE_URL not found in backend/.env');

const sql = postgres(dbUrl, { max: 1, prepare: false });

const CLD = /https?:\/\/res\.cloudinary\.com\/[^"'\s\\]+/g;

const tables = await sql`
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
    and data_type in ('text', 'character varying', 'json', 'jsonb')
  order by table_name, ordinal_position`;

const out = [];
const tableNames = [...new Set(tables.map(t => t.table_name))];
for (const t of tableNames) {
  const cols = tables.filter(c => c.table_name === t);
  const pk = await sql`
    select a.attname from pg_index i
    join pg_class c on c.oid = i.indrelid and c.relname = ${t} and c.relnamespace = 'public'::regnamespace
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary limit 1`;
  const pkCol = pk[0]?.attname;
  const colList = cols.map(c => `"${c.column_name}"`).join(', ');
  let rows;
  try {
    rows = await sql.unsafe(`select ${pkCol ? `"${pkCol}" as __pk,` : ''} ${colList} from "${t}"`);
  } catch (e) {
    console.error(`skip ${t}: ${e.message}`);
    continue;
  }
  for (const row of rows) {
    for (const c of cols) {
      const val = row[c.column_name];
      if (val == null) continue;
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      const hits = str.match(CLD);
      if (!hits) continue;
      for (const u of [...new Set(hits)]) {
        out.push({ table: t, pk: pkCol ? String(row.__pk) : null, column: c.column_name, url: u });
      }
    }
  }
}

await sql.end();
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'db-inventory.json'), JSON.stringify(out, null, 2));

// Summary: unique URLs + where they're referenced
const byUrl = {};
for (const r of out) {
  byUrl[r.url] ??= new Set();
  byUrl[r.url].add(`${r.table}.${r.column}${r.pk ? `#${r.pk}` : ''}`);
}
console.log(`unique cloudinary urls: ${Object.keys(byUrl).length}`);
for (const [u, refs] of Object.entries(byUrl).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${u}\n    ${[...refs].join(' | ')}`);
}
