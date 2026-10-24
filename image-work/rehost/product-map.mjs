// Map every ProductImage row to its product slug for the rehost mapping.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../../backend/package.json'));
const postgres = require('postgres');
const envText = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../backend/.env'), 'utf8');
const dbUrl = envText.match(/^DATABASE_URL=["']?(.+?)["']?$/m)?.[1];
const sql = postgres(dbUrl, { max: 1, prepare: false });

const rows = await sql.unsafe(`
  select p.slug, p.name, pi.id, pi."productId", pi.url, pi.position, pi.color, pi.alt
  from "ProductImage" pi join "Product" p on p.id = pi."productId"
  order by p.slug, pi.position`);
await sql.end();
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'product-map.json'), JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${r.slug} | pos=${r.sortOrder} | ${r.url.split('/').pop()} | alt=${r.alt ?? ''}`);
