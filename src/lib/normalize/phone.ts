// Phone normalisation → E.164 dedup key via libphonenumber-js.
// Default region CA (owner is Canada/US). Falls back to a digit string when
// the number can't be parsed, so we still have a (weaker) match key.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

export function normalizePhone(raw: string, defaultCountry: CountryCode = 'CA'): string {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry)
  if (parsed?.isValid()) return parsed.number // E.164, e.g. +14155550123
  const digits = raw.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : digits.replace(/\D/g, '')
}
