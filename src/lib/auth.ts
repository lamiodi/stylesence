import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { AdminUser } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Simple cookie-based admin sessions (no NextAuth by design — see worklog contract).
 * Session token -> AdminSession row; cookie `ss_admin` is httpOnly.
 */

export const ADMIN_COOKIE = 'ss_admin'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000)

/** Cookie options for the admin session cookie. */
export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

/* ------------------------------------------------------------------ *
 * Password hashing — scrypt, stored as `salt:hash` (both hex).
 * ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  let expected: Buffer
  try {
    expected = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (expected.length !== 64) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(candidate, expected)
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

/** Create a 7-day AdminSession row and return its token. */
export async function createAdminSession(adminUserId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.adminSession.create({ data: { token, adminUserId, expiresAt } })
  return { token, expiresAt }
}

/** Delete a session row by token (used by logout); silently ignores missing rows. */
export async function deleteAdminSession(token: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { token } })
}

/** Read `ss_admin` cookie, validate the session and return the admin user (or null). */
export async function getAdminFromCookies(): Promise<AdminUser | null> {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (!token) return null
  const session = await db.adminSession.findUnique({ where: { token }, include: { adminUser: true } })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  return session.adminUser
}

/** Alias used by admin routes: returns the admin user or null (route then replies 401). */
export async function requireAdmin(): Promise<AdminUser | null> {
  return getAdminFromCookies()
}

/* ------------------------------------------------------------------ *
 * Naive in-memory login rate limit: max 5 failures per email / 5 min.
 * ------------------------------------------------------------------ */

const LOGIN_WINDOW_MS = 5 * 60 * 1000
const LOGIN_MAX_FAILURES = 5
const loginFailures = new Map<string, number[]>()

function recentFailures(email: string, now: number): number[] {
  return (loginFailures.get(email) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS)
}

/** False when this email is currently rate-limited. */
export function checkLoginRateLimit(email: string): boolean {
  const now = Date.now()
  const recent = recentFailures(email, now)
  loginFailures.set(email, recent)
  return recent.length < LOGIN_MAX_FAILURES
}

export function recordLoginFailure(email: string): void {
  const now = Date.now()
  const recent = recentFailures(email, now)
  recent.push(now)
  loginFailures.set(email, recent)
}

export function clearLoginFailures(email: string): void {
  loginFailures.delete(email)
}
