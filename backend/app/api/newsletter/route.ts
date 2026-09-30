import { sql, cuid } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { newsletterInput } from '@/lib/validators'
import { sendWelcomeNewsletterEmail } from '@/lib/email'
import { checkIpRateLimit, clientKey } from '@/lib/rate-limit'

/** POST /api/newsletter — dedupe via upsert; always `{ ok: true }` for a valid email. */
export async function POST(req: Request) {
  if (!checkIpRateLimit(`newsletter:${clientKey(req)}`, 5, 5 * 60 * 1000)) {
    return fail(429, 'Too many signups from this network — please try again in a few minutes.')
  }

  const parsed = await readValidated(req, newsletterInput)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "NewsletterSubscriber" WHERE email = ${email} LIMIT 1
  `

  if (!existing[0]) {
    await sql`
      INSERT INTO "NewsletterSubscriber" (id, email, source, "createdAt")
      VALUES (${cuid()}, ${email}, 'footer', now())
    `

    // Send the luxury welcome email + ATELIER10 voucher code via Resend
    sendWelcomeNewsletterEmail(email).catch((err) =>
      console.error('[api/newsletter] Failed to dispatch welcome newsletter email:', err)
    )
  }

  return ok({ ok: true })
}
