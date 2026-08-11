import 'server-only'

// Server-only env access. Only the DAL / server utils import this.
// Lazy getters — never throws at import time (would break `next build`),
// only when a missing required value is actually read.

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }, // sb_publishable_
  get supabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  }, // sb_secret_ (server only)

  get aesTokenKey() {
    return process.env.AES_TOKEN_KEY
  },
  get actionLinkSecret() {
    return process.env.ACTION_LINK_SECRET
  },
  get cronSecret() {
    return process.env.CRON_SECRET
  },

  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY
  },
  get resendKey() {
    return process.env.RESEND_API_KEY
  },
  get resendFrom() {
    return process.env.RESEND_FROM
  },
  get digestTo() {
    return process.env.DIGEST_TO
  },

  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID
  },
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET
  },

  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  },
}
