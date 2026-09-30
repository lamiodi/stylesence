import { sql } from '../lib/db'
async function main() {
  const rows = await sql<{ slug: string; pos: number; f: string; color: string | null }[]>`
    SELECT p.slug, pi.position AS pos, split_part(pi.url, '/', -1) AS f, pi.color
    FROM "ProductImage" pi JOIN "Product" p ON p.id = pi."productId"
    ORDER BY p.slug, pi.position`
  for (const r of rows) console.log(r.slug.slice(4, 20).padEnd(16), String(r.pos).padStart(2), r.f.padEnd(44), r.color ?? '(null)')
  await sql.end()
}
main().catch(e => { console.error('FAILED:', e); process.exitCode = 1; sql.end().then(() => process.exit(1)) })
