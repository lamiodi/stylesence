import crypto from 'node:crypto'
import postgres from 'postgres'

/**
 * Postgres access via postgres.js (plain SQL — Prisma removed 2026-09-30).
 *
 * - Pooler-safe: prepared statements disabled (Supabase pooler) and TLS is
 *   enabled when the connection string carries sslmode=require.
 * - `cuid()` replaces Prisma's @default(cuid()): timestamp-prefixed ids so
 *   `ORDER BY id ASC` still equals insertion order within this process.
 * - postgres.js 3.4.9 ships no sql.in/sql.join/sql.raw helpers (neither at
 *   runtime nor in its types), so `sqlIn`/`sqlJoin`/`sqlRaw` below implement
 *   the same fragment protocol a nested sql`` template uses.
 */

const rawUrl = process.env.DATABASE_URL ?? ''
const needsSsl = /sslmode=require/i.test(rawUrl)

const globalForSql = globalThis as unknown as {
  __ss_sql: ReturnType<typeof postgres> | undefined
}

export const sql = globalForSql.__ss_sql ?? postgres(rawUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
})

globalForSql.__ss_sql = sql

/** Callable SQL handle — the pool itself or an open `sql.begin` transaction. */
export type SqlLike = typeof sql | TxSql
export type TxSql = postgres.TransactionSql

/* ------------------------------------------------------------------ *
 * Fragment helpers (IN lists, joined VALUES rows, raw identifier text).
 * postgres.js 3.4.9 has no sql.in/sql.join/sql.raw, but a nested sql``
 * template is flattened wherever a Query instance appears as a parameter —
 * so these build REAL Query fragments by calling sql with a synthetic
 * template-strings array (strings.length === args.length + 1).
 * ------------------------------------------------------------------ */

type Fragment = postgres.Fragment

/** Build a real Query fragment from arbitrary static chunks + parameters. */
function buildFragment(strings: string[], args: unknown[]): postgres.Fragment {
  const templateStrings = Object.assign([...strings], { raw: [...strings] }) as TemplateStringsArray
  return (sql as unknown as (s: TemplateStringsArray, ...a: unknown[]) => postgres.Fragment)(
    templateStrings,
    ...args,
  )
}

/** `IN (...)` list fragment — parameterized values. Empty lists are invalid SQL: guard before use. */
export function sqlIn(values: readonly unknown[]): Fragment {
  const strings: string[] = ['(']
  const args: unknown[] = []
  values.forEach((v, i) => {
    if (i > 0) strings.push(', ')
    args.push(v)
  })
  strings.push(')')
  return buildFragment(strings, args)
}

/** Join query fragments (typically row-tuple fragments) with a plain-string separator. */
export function sqlJoin(fragments: readonly unknown[], separator = ', '): Fragment {
  const strings: string[] = []
  const args: unknown[] = []
  fragments.forEach((f, i) => {
    const part = f as { strings?: unknown[]; args?: unknown[] }
    if (!part || !Array.isArray(part.strings) || !Array.isArray(part.args)) {
      throw new TypeError('sqlJoin expects fragments created with sql`` templates')
    }
    if (i === 0) {
      strings.push(...part.strings.map(String))
    } else {
      // Boundary chunks merge into one static element: strings.length stays args.length + 1.
      strings[strings.length - 1] += separator + String(part.strings[0])
      strings.push(...part.strings.slice(1).map(String))
    }
    args.push(...part.args)
  })
  if (strings.length === 0) strings.push('')
  return buildFragment(strings, args)
}

/** Raw SQL text fragment — NEVER pass user input; use only for fixed identifiers. */
export function sqlRaw(text: string): Fragment {
  return buildFragment([text], [])
}

/* ------------------------------------------------------------------ *
 * ID generation (replaces Prisma's cuid() default).
 * ------------------------------------------------------------------ */

let cuidCounter = 0

/** Sortable cuid-style id: 'c' + base36 timestamp + counter + random. */
export function cuid(): string {
  const timestamp = Date.now().toString(36)
  const counter = (cuidCounter = (cuidCounter + 1) % 1_679_616)
    .toString(36)
    .padStart(4, '0')
  const random = crypto.randomBytes(8).toString('hex')
  return `c${timestamp}${counter}${random}`
}
