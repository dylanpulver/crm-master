// Throwaway: render + send a real digest via Resend.
// Run: npx tsx scripts/dev/test-digest.ts <to-email>
import { readFileSync } from 'node:fs'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { DailyDigest, type DailyDigestProps } from '../../src/emails/DailyDigest'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const to = process.argv[2] ?? 'test@example.com'

const props: DailyDigestProps = {
  operatorName: 'Alex',
  dateLabel: 'Tue, Jun 17',
  appUrl: 'http://localhost:3000',
  nudges: [
    {
      personName: 'Sam Patel',
      reason: 'Going cold (close contact, 34 days quiet)',
      lastTouchLabel: 'last: coffee Apr 10',
      draftPreview: 'Sam, good talking over coffee. attached is the one-pager on how I scoped Atlas…',
      approveUrl: 'http://localhost:3000/api/a/approve_send?t=demo',
      snoozeUrl: 'http://localhost:3000/api/a/snooze?t=demo',
      logTouchUrl: 'http://localhost:3000/api/a/log_touch?t=demo',
    },
    {
      personName: 'Dana Cole',
      reason: 'Going cold (known, 71 days quiet)',
      lastTouchLabel: 'last: email May 2',
      snoozeUrl: 'http://localhost:3000/api/a/snooze?t=demo2',
      logTouchUrl: 'http://localhost:3000/api/a/log_touch?t=demo2',
    },
    {
      personName: 'Jordan Webb',
      reason: 'Birthday tomorrow',
      lastTouchLabel: 'last: call Mar 19',
      draftPreview: 'happy birthday Jordan! hope the year ahead is a big one…',
      approveUrl: 'http://localhost:3000/api/a/approve_send?t=demo3',
      snoozeUrl: 'http://localhost:3000/api/a/snooze?t=demo3',
      logTouchUrl: 'http://localhost:3000/api/a/log_touch?t=demo3',
    },
  ],
}

async function main() {
  const html = await render(DailyDigest(props))
  console.log('rendered html bytes:', html.length)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'onboarding@resend.dev',
    to,
    subject: `Your warm list — ${props.dateLabel}`,
    html,
  })
  if (error) {
    console.error('SEND ERROR:', error)
    process.exit(1)
  }
  console.log('SENT ✓ to', to, '| id:', data?.id)
}
main()
