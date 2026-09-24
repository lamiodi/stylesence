import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 10 })
  try {
    const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`
    console.log('CONNECTED OK. public tables:', tables.length)
    for (const t of tables) console.log(' -', t.table_name)
    const products = await sql`select slug from "Product" order by id limit 6`
    console.log('Product rows:', products.map((p: any) => p.slug).join(', '))
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('FAILED:', e.code ?? '', e.message)
  process.exit(1)
})
