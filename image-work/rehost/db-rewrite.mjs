// Rewrite stored Cloudinary URLs to self-hosted /media URLs, table by table.
// Dry-run by default; pass --write to commit inside one transaction.
// Run: node image-work/rehost/db-rewrite.mjs [--write]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');

const require = createRequire(resolve(rootPkg(), 'backend/package.json'));
function rootPkg() { return resolve(here, '../..'); }
const postgres = require('postgres');
const envText = readFileSync(resolve(here, '../../backend/.env'), 'utf8');
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?$/m)?.[1];
const sql = postgres(dbUrl, { max: 1, prepare: false });

const MAP = JSON.parse(readFileSync(resolve(here, 'url-map.json'), 'utf8'));
// Stored URLs are absolute (www is canonical) so order-email thumbnails and
// og:image tags render without server-side absolutization.
const ORIGIN = 'https://www.stylesence.com';

// Pull the cloud asset path (after stylesence/) out of any Cloudinary URL,
// transform chain or not.
const CLD = /https?:\/\/res\.cloudinary\.com\/[^"'\s\\]+/g;
function cloudPath(url) {
  const m = /res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?stylesence\/(.+?)(?:\?|$)/.exec(url);
  return m ? m[1] : null;
}
function rewriteUrl(url) {
  const p = cloudPath(url);
  if (!p) return null;
  const next = MAP[p];
  return next ? `${ORIGIN}${next}` : null;
}
function rewriteValue(str) {
  return str.replace(CLD, (u) => {
    const next = rewriteUrl(u);
    return next ?? u; // unmapped URLs stay untouched and get reported below
  });
}

const tables = await sql`
  select table_name, column_name from information_schema.columns
  where table_schema = 'public' and data_type in ('text', 'character varying', 'json', 'jsonb')
  order by table_name, ordinal_position`;
const tableNames = [...new Set(tables.map((t) => t.table_name))];

const plan = [];
const unmapped = new Set();
for (const t of tableNames) {
  const cols = tables.filter((c) => c.table_name === t);
  const pk = await sql`
    select a.attname from pg_index i
    join pg_class c on c.oid = i.indrelid and c.relname = ${t} and c.relnamespace = 'public'::regnamespace
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary limit 1`;
  const pkCol = pk[0]?.attname;
  if (!pkCol) continue;
  const colList = cols.map((c) => `"${c.column_name}"`).join(', ');
  let rows;
  try {
    rows = await sql.unsafe(`select "${pkCol}" as __pk, ${colList} from "${t}"`);
  } catch {
    continue;
  }
  for (const row of rows) {
    for (const c of cols) {
      const val = row[c.column_name];
      if (val == null) continue;
      const isText = typeof val === 'string';
      const str = isText ? val : JSON.stringify(val);
      if (!str.includes('res.cloudinary.com')) continue;
      const nextStr = rewriteValue(str);
      for (const u of str.match(CLD) ?? []) {
        if (!rewriteUrl(u)) unmapped.add(u);
      }
      if (nextStr === str) continue;
      plan.push({
        table: t, pkCol, pk: String(row.__pk), column: c.column_name,
        isJson: !isText, old: str, new: nextStr,
      });
    }
  }
}

await sql.end();

console.log(`planned updates: ${plan.length}`);
for (const p of plan) {
  console.log(`${p.table}.${p.column} #${p.pk}`);
  console.log(`  - ${p.old.length > 140 ? p.old.slice(0, 140) + '…' : p.old}`);
  console.log(`  + ${p.new.length > 140 ? p.new.slice(0, 140) + '…' : p.new}`);
}
if (unmapped.size) {
  console.log(`\nUNMAPPED cloudinary URLs (left as-is):`);
  for (const u of unmapped) console.log(`  ! ${u}`);
}
if (!plan.length) { console.log('nothing to do'); process.exit(0); }

if (!WRITE) {
  console.log('\ndry-run only — rerun with --write to apply');
  process.exit(0);
}

// ── apply: one transaction, backup written first ──
writeFileSync(resolve(here, 'db-rewrite-backup.json'), JSON.stringify(plan, null, 2));
console.log('wrote db-rewrite-backup.json (rollback source)');

const db2 = postgres(dbUrl, { max: 1, prepare: false });
await db2.begin(async (tx) => {
  for (const p of plan) {
    // For json columns, the new value is a JSON document; text columns are raw strings.
    if (p.isJson) {
      await tx.unsafe(`update "${p.table}" set "${p.column}" = $1::jsonb where "${p.pkCol}" = $2`, [p.new, p.pk]);
    } else {
      await tx.unsafe(`update "${p.table}" set "${p.column}" = $1 where "${p.pkCol}" = $2`, [p.new, p.pk]);
    }
  }
});
await db2.end();
console.log(`applied ${plan.length} updates in one transaction`);
