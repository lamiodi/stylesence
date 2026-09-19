import { db } from '@/lib/db'
import { ok, readValidated } from '@/lib/api-helpers'
import { newsletterInput } from '@/lib/validators'
import { sendWelcomeNewsletterEmail } from '@/lib/email'

/** POST /api/newsletter — dedupe via upsert; always `{ ok: true }` for a valid email. */
export async function POST(req: Request) {
  const parsed = await readValidated(req, newsletterInput)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data

  const existing = await db.newsletterSubscriber.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!existing) {
    await db.newsletterSubscriber.create({
      data: { email, source: 'footer' },
    })

    // Send the luxury welcome email + ATELIER10 voucher code via Resend
    sendWelcomeNewsletterEmail(email).catch((err) =>
      console.error('[api/newsletter] Failed to dispatch welcome newsletter email:', err)
    )
  }

  return ok({ ok: true })
}
