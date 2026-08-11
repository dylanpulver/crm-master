import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase/server'
import { verifyAction, type ActionPayload } from '@/lib/crypto/actionLinks'
import { applyInteraction } from '@/lib/scoring/engagement'

export const dynamic = 'force-dynamic'

// One-tap action handler for digest links. HMAC-verified + expiry-checked.
// snooze / log_touch are reversible/idempotent → execute on GET.
// approve_send is IRREVERSIBLE → GET only renders a confirm page; the mutation
// runs on POST, so an email link-prefetcher (which issues GET) can't trigger it.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function page(title: string, body: string, ok = true) {
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:ui-sans-serif,system-ui;background:#0b0c10;color:#e7e9ee;display:grid;place-items:center;height:100vh;margin:0">
     <div style="text-align:center;max-width:360px;padding:24px">
       <div style="font-size:40px">${ok ? '✓' : '⚠️'}</div>
       <h2 style="margin:8px 0">${title}</h2>
       <p style="color:#9aa0ad">${body}</p>
     </div></body>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html' } }
  )
}

function confirmPage(token: string, personName: string) {
  // GET landing for approve_send: a form that POSTs back with the token.
  // personName is DB-sourced → escape it. CSP blocks any injected script anyway.
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:ui-sans-serif,system-ui;background:#0b0c10;color:#e7e9ee;display:grid;place-items:center;height:100vh;margin:0">
     <div style="text-align:center;max-width:360px;padding:24px">
       <h2 style="margin:0 0 8px">Send to ${escapeHtml(personName)}?</h2>
       <p style="color:#9aa0ad;margin:0 0 20px">This approves and sends the drafted message.</p>
       <form method="POST" action="/api/a/approve_send?t=${encodeURIComponent(token)}">
         <button type="submit" style="background:#6e78ff;color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;padding:12px 22px;cursor:pointer">Confirm &amp; send</button>
       </form>
     </div></body>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      },
    }
  )
}

async function loadNudge(sb: ReturnType<typeof createServiceSupabase>, payload: ActionPayload) {
  const { data } = await sb
    .from('nudge')
    .select('id, person_id, person:person_id(full_name)')
    .eq('id', payload.nudgeId)
    .eq('operator_id', payload.operatorId)
    .single()
  return data
}

async function logTouch(
  sb: ReturnType<typeof createServiceSupabase>,
  payload: ActionPayload,
  personId: string,
  isApprove: boolean
) {
  const now = new Date()
  const type = isApprove ? 'email' : 'note'
  await sb.from('interaction').insert({
    operator_id: payload.operatorId,
    person_id: personId,
    type,
    direction: 'outbound',
    occurred_at: now.toISOString(),
    summary: isApprove ? 'Sent follow-up (approved from digest)' : 'Logged touch',
    source: 'manual',
  })
  const { data: rel } = await sb
    .from('operator_relationship')
    .select('engagement_score, engagement_updated_at')
    .eq('operator_id', payload.operatorId)
    .eq('person_id', personId)
    .single()
  if (rel) {
    const engagement = applyInteraction({
      current: rel.engagement_score,
      updatedAt: new Date(rel.engagement_updated_at),
      occurredAt: now,
      type,
    })
    await sb
      .from('operator_relationship')
      .update({
        engagement_score: engagement,
        engagement_updated_at: now.toISOString(),
        last_touch_at: now.toISOString(),
      })
      .eq('operator_id', payload.operatorId)
      .eq('person_id', personId)
  }
  await sb.from('nudge').update({ status: 'done', resolved_at: now.toISOString() }).eq('id', payload.nudgeId)
  if (isApprove) {
    await sb.from('draft').update({ status: 'sent', sent_at: now.toISOString() }).eq('nudge_id', payload.nudgeId)
  }
}

function verifyFromRequest(request: Request, expectedAction: ActionPayload['action']) {
  const token = new URL(request.url).searchParams.get('t')
  const payload = token ? verifyAction(token) : null
  if (!payload || payload.action !== expectedAction) return { token, payload: null as ActionPayload | null }
  return { token, payload }
}

// GET: snooze + log_touch execute; approve_send only renders the confirm page.
export async function GET(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (action !== 'snooze' && action !== 'log_touch' && action !== 'approve_send') {
    return page('Unknown action', 'Nothing to do.', false)
  }
  const { token, payload } = verifyFromRequest(request, action)
  if (!payload) return page('Invalid or expired link', 'Please use a fresh digest.', false)

  const sb = createServiceSupabase()
  const nudge = await loadNudge(sb, payload)
  if (!nudge) return page('Link expired', 'That nudge is no longer available.', false)
  const p = nudge.person as { full_name: string } | { full_name: string }[] | null
  const personName = (Array.isArray(p) ? p[0]?.full_name : p?.full_name) ?? 'this contact'

  if (action === 'approve_send') {
    return confirmPage(token!, personName) // mutation happens on POST only
  }
  if (action === 'snooze') {
    const until = new Date(Date.now() + 3 * 86_400_000).toISOString()
    await sb.from('nudge').update({ status: 'snoozed', snoozed_until: until }).eq('id', payload.nudgeId)
    return page('Snoozed', 'We’ll resurface this in 3 days.')
  }
  await logTouch(sb, payload, nudge.person_id, false)
  return page('Logged', 'Touch logged — cadence reset.')
}

// POST: the only irreversible action — approve_send — runs here.
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (action !== 'approve_send') return page('Unsupported', 'Use the digest links.', false)
  const { payload } = verifyFromRequest(request, 'approve_send')
  if (!payload) return page('Invalid or expired link', 'Please use a fresh digest.', false)

  const sb = createServiceSupabase()
  const nudge = await loadNudge(sb, payload)
  if (!nudge) return page('Link expired', 'That nudge is no longer available.', false)
  await logTouch(sb, payload, nudge.person_id, true)
  return page('Approved', 'Marked sent and logged. (Live send wiring is next.)')
}
