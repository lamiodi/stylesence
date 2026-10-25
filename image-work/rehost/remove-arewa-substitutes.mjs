// Remove the two Àrẹ̀wà Set substitute gallery items (arewa-video.mp4,
// arewa-frame.webp) — user request 2026-10-24. Dry-run by default; --write
// deletes the ProductImage rows after saving full-row backups.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');
const BACKUP = resolve(here, 'arewa-substitute-removal-backup.json');

const require = createRequire(resolve(here, '../../backend/package.json'));
const postgres = require('postgres');
const envText = readFileSync(resolve(here, '../../backend/.env'), 'utf8');
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?$/m)?.[1];
const sql = postgres(dbUrl, { max: 1, prepare: false });

const LIKE = ['%arewa-video%', '%arewa-frame%'];

// 1) any reference anywhere outside ProductImage (orders, journal, etc.)?
const outside = await sql.unsafe(`
  select 'OrderItem' as tbl, id, "imageUrl" as val from "OrderItem"
    where "imageUrl" like '%arewa-video%' or "imageUrl" like '%arewa-frame%'
  union all
  select 'JournalPost', id, "coverImage" from "JournalPost"
    where "coverImage" like '%arewa-video%' or "coverImage" like '%arewa-frame%'
  union all
  select 'Category', id, "imageUrl" from "Category"
    where "imageUrl" like '%arewa-video%' or "imageUrl" like '%arewa-frame%'`);
if (outside.length) {
  console.error('REFUSED — outside references exist:', JSON.stringify(outside, null, 1));
  await sql.end();
  process.exit(1);
}

// 2) the gallery rows themselves
const rows = await sql.unsafe(`select * from "ProductImage" where url like '%arewa-video%' or url like '%arewa-frame%'`);
console.log(`gallery rows to delete: ${rows.length}`);
for (const r of rows) console.log(`  ${r.id}  ${r.url}  (product ${r.productId})`);
if (rows.length !== 2) {
  console.error('expected exactly 2 rows — aborting');
  await sql.end();
  process.exit(1);
}

if (!WRITE) {
  console.log('dry-run only — rerun with --write to delete');
  await sql.end();
  process.exit(0);
}

writeFileSync(BACKUP, JSON.stringify(rows, null, 2));
console.log(`saved ${BACKUP}`);

await sql.begin(async (tx) => {
  for (const r of rows) {
    await tx.unsafe(`delete from "ProductImage" where id = $1`, [r.id]);
  }
});
console.log('deleted 2 rows');
await sql.end();
