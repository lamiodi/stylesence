/**
 * Rotate an admin account's password (raw SQL — works even when the local
 * Prisma client is stale; the hash format matches lib/auth: `salt:hash` hex,
 * scrypt 64 bytes).
 *
 *   npx tsx --env-file=.env scripts/change-admin-password.ts <email> [newPassword]
 *
 * Password rules: 10+ chars. Without a password argument a strong one is
 * generated and printed once. Also revokes the account's live sessions so a
 * stolen cookie dies with the old password.
 */
import postgres from 'postgres'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const [email, provided] = process.argv.slice(2)
  if (!email) {
    console.error('Usage: npx tsx --env-file=.env scripts/change-admin-password.ts <email> [newPassword]')
    process.exit(1)
  }

  const sql = postgres(process.env.DATABASE_URL!)
  const rows = await sql`SELECT id FROM "AdminUser" WHERE email = ${email.toLowerCase()} LIMIT 1`
  if (rows.length === 0) {
    console.error(`No admin account with email ${email}`)
    process.exit(1)
  }
  const id = rows[0].id as string

  const password = provided ?? crypto.randomBytes(12).toString('base64url')
  if (password.length < 10) {
    console.error('Password must be at least 10 characters.')
    process.exit(1)
  }

  await sql`UPDATE "AdminUser" SET "passwordHash" = ${hashPassword(password)} WHERE id = ${id}`
  await sql`DELETE FROM "AdminSession" WHERE "adminUserId" = ${id}`
  await sql.end()

  console.log(`✓ Password rotated for ${email}; existing sessions revoked.`)
  if (!provided) console.log(`New password (shown once): ${password}`)
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
