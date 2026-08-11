import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

// HMAC-signed one-tap action links for the daily digest.
// Stateless capability: {action, nudgeId, exp}. Single-use is enforced at the
// DB layer (consume flag) — this module handles signing + expiry only.

export type ActionPayload = {
  action: 'snooze' | 'log_touch' | 'approve_send'
  nudgeId: string
  operatorId: string
  exp: number // unix seconds
}

function secret(): string {
  if (!env.actionLinkSecret) throw new Error('ACTION_LINK_SECRET not set')
  return env.actionLinkSecret
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function signAction(payload: Omit<ActionPayload, 'exp'>, ttlSeconds = 36 * 3600): string {
  const full: ActionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const body = b64url(Buffer.from(JSON.stringify(full)))
  const sig = b64url(createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyAction(token: string): ActionPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = b64url(createHmac('sha256', secret()).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ActionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
