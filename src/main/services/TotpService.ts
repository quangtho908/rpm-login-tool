import { getDb } from '../db/db'
import { decryptFromBase64, encryptToBase64 } from './CryptoService'
import { authenticator } from 'otplib'
import { audit } from './AuditLogService'

export function generateTotpSecret(): { secret: string } {
  // Base32 secret, compatible with Google Authenticator/Authy etc.
  const secret = authenticator.generateSecret()
  audit('totp:generateSecret')
  return { secret }
}

export function setTotpSecret(input: {
  profileId: string
  issuer?: string | null
  accountName?: string | null
  secret: string
}): void {
  const db = getDb()
  const now = new Date().toISOString()

  const normalized = input.secret.replace(/\s+/g, '').toUpperCase()
  const secretEnc = encryptToBase64(normalized)

  db.prepare(
    `INSERT INTO totp_secrets (profileId, issuer, accountName, secretEnc, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(profileId) DO UPDATE SET
       issuer=excluded.issuer,
       accountName=excluded.accountName,
       secretEnc=excluded.secretEnc,
       updatedAt=excluded.updatedAt`
  ).run(input.profileId, input.issuer ?? null, input.accountName ?? null, secretEnc, now, now)

  audit('totp:setSecret', { profileId: input.profileId })
}

export function getTotpCode(input: { profileId: string }): { code: string; secondsRemaining: number } {
  const db = getDb()
  const row = db.prepare('SELECT secretEnc FROM totp_secrets WHERE profileId=?').get(input.profileId) as any
  if (!row) throw new Error('No TOTP secret set for this profile')

  // Stored secret is Base32 (Authenticator-style)
  const secret = decryptFromBase64(row.secretEnc)
  const code = authenticator.generate(secret)

  const step = authenticator.options.step ?? 30
  const now = Math.floor(Date.now() / 1000)
  const secondsRemaining = step - (now % step)

  audit('totp:getCode', { profileId: input.profileId })

  return { code, secondsRemaining }
}
