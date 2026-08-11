import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

// AES-256-GCM for OAuth refresh tokens. Key lives OUTSIDE the DB (env/KMS).
// Stored columns: ciphertext (bytea), iv (bytea), auth_tag (bytea).

function key(): Buffer {
  if (!env.aesTokenKey) throw new Error('AES_TOKEN_KEY not set')
  const k = Buffer.from(env.aesTokenKey, 'base64')
  if (k.length !== 32) throw new Error('AES_TOKEN_KEY must be 32 bytes (base64)')
  return k
}

export type EncryptedToken = { ciphertext: Buffer; iv: Buffer; authTag: Buffer }

export function encryptToken(plain: string): EncryptedToken {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return { ciphertext, iv, authTag: cipher.getAuthTag() }
}

export function decryptToken({ ciphertext, iv, authTag }: EncryptedToken): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
