// Email normalisation → a canonical dedup key. Store both the verbatim value
// (for display) and this normalized_value (for matching).
//
// Rules: lowercase + trim always. Gmail-ONLY: strip dots and +tags from the
// local part (j.o.h.n+x@gmail.com → john@gmail.com). NEVER apply dot/plus
// stripping to other providers (there a.b@ ≠ ab@).

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

export function normalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at === -1) return trimmed // not an email; return as-is lowercased

  let local = trimmed.slice(0, at)
  let domain = trimmed.slice(at + 1)

  if (GMAIL_DOMAINS.has(domain)) {
    domain = 'gmail.com'
    const plus = local.indexOf('+')
    if (plus !== -1) local = local.slice(0, plus)
    local = local.replace(/\./g, '')
  }

  return `${local}@${domain}`
}

const ROLE_LOCALPARTS = /^(no-?reply|do-?not-?reply|noreply|notifications?|mailer-daemon|postmaster|bounce|support|info|hello|billing|receipts?|sales|admin)$/

/** True for non-personal/role/automated addresses that shouldn't become contacts. */
export function isRoleAddress(raw: string): boolean {
  const at = raw.indexOf('@')
  const local = (at === -1 ? raw : raw.slice(0, at)).trim().toLowerCase()
  return ROLE_LOCALPARTS.test(local)
}
