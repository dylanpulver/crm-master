import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Link,
} from '@react-email/components'

// The daily digest — the product's forcing function. Renders the top nudges with
// HMAC-signed one-tap action links. Pre-signed URLs are passed in (signing happens
// server-side when the digest is built). Pure markup; no secrets here.

export type DigestNudge = {
  personName: string
  reason: string
  lastTouchLabel: string
  draftPreview?: string
  approveUrl?: string // approve & send the drafted message (lands on a confirm page)
  snoozeUrl: string
  logTouchUrl: string
}

export type DailyDigestProps = {
  operatorName: string
  dateLabel: string
  nudges: DigestNudge[]
  appUrl: string
}

const c = {
  body: { backgroundColor: '#0b0c10', color: '#e7e9ee', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0, padding: '24px 0' },
  container: { maxWidth: '560px', margin: '0 auto', padding: '0 16px' },
  h1: { fontSize: '20px', fontWeight: 700, margin: '0 0 4px' },
  sub: { fontSize: '13px', color: '#9aa0ad', margin: '0 0 20px' },
  card: { backgroundColor: '#15171e', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  name: { fontSize: '16px', fontWeight: 600, margin: '0 0 2px' },
  reason: { fontSize: '13px', color: '#9aa0ad', margin: '0 0 10px' },
  draft: { fontSize: '13px', color: '#c7ccd6', backgroundColor: '#1c1f28', borderRadius: '8px', padding: '10px', margin: '0 0 12px', whiteSpace: 'pre-wrap' as const },
  btnPrimary: { backgroundColor: '#6e78ff', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, padding: '8px 14px', textDecoration: 'none', display: 'inline-block', marginRight: '8px' },
  btnGhost: { color: '#9aa0ad', fontSize: '13px', padding: '8px 12px', textDecoration: 'none', display: 'inline-block', marginRight: '8px' },
  footer: { fontSize: '12px', color: '#6b7280', textAlign: 'center' as const, marginTop: '8px' },
}

export function DailyDigest({ operatorName, dateLabel, nudges, appUrl }: DailyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${nudges.length} people to warm today`}</Preview>
      <Body style={c.body}>
        <Container style={c.container}>
          <Heading style={c.h1}>{`Today's warm list, ${operatorName}`}</Heading>
          <Text style={c.sub}>{`${dateLabel} · ${nudges.length} ${nudges.length === 1 ? 'person' : 'people'} going cold`}</Text>

          {nudges.map((n, i) => (
            <Section key={i} style={c.card}>
              <Text style={c.name}>{n.personName}</Text>
              <Text style={c.reason}>{`${n.reason} · ${n.lastTouchLabel}`}</Text>
              {n.draftPreview ? <Text style={c.draft}>{n.draftPreview}</Text> : null}
              <Section>
                {n.approveUrl ? (
                  <Button href={n.approveUrl} style={c.btnPrimary}>
                    Approve &amp; send
                  </Button>
                ) : null}
                <Link href={n.logTouchUrl} style={c.btnGhost}>
                  Log touch
                </Link>
                <Link href={n.snoozeUrl} style={c.btnGhost}>
                  Snooze
                </Link>
              </Section>
            </Section>
          ))}

          <Hr style={{ borderColor: '#1c1f28', margin: '16px 0' }} />
          <Text style={c.footer}>
            <Link href={appUrl} style={{ color: '#6b7280' }}>
              Open crm-master
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DailyDigest
