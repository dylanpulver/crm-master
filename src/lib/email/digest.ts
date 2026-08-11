import 'server-only'

import { Resend } from 'resend'
import { render } from '@react-email/render'
import { DailyDigest, type DailyDigestProps } from '@/emails/DailyDigest'
import { env } from '@/lib/env'

// Render + send the daily digest via Resend. Server-only.

export async function renderDigestHtml(props: DailyDigestProps): Promise<string> {
  return render(DailyDigest(props))
}

export async function sendDigest(to: string, props: DailyDigestProps): Promise<{ id: string }> {
  if (!env.resendKey) throw new Error('RESEND_API_KEY not set')
  const resend = new Resend(env.resendKey)
  const html = await renderDigestHtml(props)
  const { data, error } = await resend.emails.send({
    from: env.resendFrom ?? 'onboarding@resend.dev',
    to,
    subject: `Your warm list — ${props.dateLabel}`,
    html,
  })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
  return { id: data!.id }
}
