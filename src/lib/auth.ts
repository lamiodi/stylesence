import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { AdminUser, Customer } from '@prisma/client'
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

/* ------------------------------------------------------------------ *
 * Customer accounts — httpOnly cookie `ss_customer` -> CustomerSession row.
 * Customers get a 30-day TTL (admins keep the 7-day one above).
 * ------------------------------------------------------------------ */

export const CUSTOMER_COOKIE = 'ss_customer'

const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const CUSTOMER_SESSION_MAX_AGE_SECONDS = Math.floor(CUSTOMER_SESSION_TTL_MS / 1000)

/** Cookie options for the customer session cookie. */
export function customerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  }
}

/** Create a 30-day CustomerSession row and return its token. */
export async function createCustomerSession(customerId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS)
  await db.customerSession.create({ data: { token, customerId, expiresAt } })
  return { token, expiresAt }
}

/** Delete a customer session row by token (used by logout); silently ignores missing rows. */
export async function deleteCustomerSession(token: string): Promise<void> {
  await db.customerSession.deleteMany({ where: { token } })
}

/** Read `ss_customer` cookie, validate the session and return the customer (or null). */
export async function getCustomerFromCookies(): Promise<Customer | null> {
  const jar = await cookies()
  const token = jar.get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  const session = await db.customerSession.findUnique({ where: { token }, include: { customer: true } })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.customerSession.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  return session.customer
}

/* ------------------------------------------------------------------ *
 * Customer login rate limit — a SEPARATE map so customer bursts never
 * lock the admin console (and vice versa). Same 5 failures / 5 min.
 * ------------------------------------------------------------------ */

const CUSTOMER_LOGIN_WINDOW_MS = 5 * 60 * 1000
const CUSTOMER_LOGIN_MAX_FAILURES = 5
const customerLoginFailures = new Map<string, number[]>()

function recentCustomerFailures(email: string, now: number): number[] {
  return (customerLoginFailures.get(email) ?? []).filter((t) => now - t < CUSTOMER_LOGIN_WINDOW_MS)
}

/** False when this email is currently rate-limited for customer logins. */
export function checkCustomerLoginRateLimit(email: string): boolean {
  const now = Date.now()
  const recent = recentCustomerFailures(email, now)
  customerLoginFailures.set(email, recent)
  return recent.length < CUSTOMER_LOGIN_MAX_FAILURES
}

export function recordCustomerLoginFailure(email: string): void {
  const now = Date.now()
  const recent = recentCustomerFailures(email, now)
  recent.push(now)
  customerLoginFailures.set(email, recent)
}

export function clearCustomerLoginFailures(email: string): void {
  customerLoginFailures.delete(email)
}

/*
 * NOTE (password-reset rate limiting): reset requests reuse the SAME map and
 * helpers above — reset requests and login failures share one 5-per-5-min
 * budget per email. This is deliberate anti-enumeration behaviour (lead's
 * decision): unknown emails burn the budget on BOTH paths, so an attacker
 * cannot probe for accounts via reset requests any faster than via logins,
 * and no second map is needed.
 */

/* ------------------------------------------------------------------ *
 * Password reset tokens — 192-bit random, stored HASHED (sha256).
 *
 * Unlike passwords (slow scrypt above), the reset token is itself a
 * fresh 192-bit random value, so a single fast hash is sufficient:
 * brute-forcing the hash means guessing the 48-hex-char token, not
 * a human password. Hashing at rest means a DB leak cannot be
 * replayed as live reset links. The plain token only ever travels
 * in the (dev-simulated) email link; the DB keeps only the hash.
 * ------------------------------------------------------------------ */

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/** sha256 hex of a reset token — see the section note for why not scrypt. */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Generate a single-use reset token: `plain` goes in the link, `hash` is stored. */
export function generateResetToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(24).toString('hex') // 48 hex chars — passes the 20–200 validator
  return { plain, hash: hashResetToken(plain) }
}
