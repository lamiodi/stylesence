import { db } from '@/lib/db'
import { ok, readValidated } from '@/lib/api-helpers'
import { newsletterInput } from '@/lib/validators'

/** POST /api/newsletter — dedupe via upsert; always `{ ok: true }` for a valid email. */
export async function POST(req: Request) {
  const parsed = await readValidated(req, newsletterInput)
  if (!parsed.ok) return parsed.response

  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: { email: parsed.data.email, source: 'footer' },
  })

  return ok({ ok: true })
}
