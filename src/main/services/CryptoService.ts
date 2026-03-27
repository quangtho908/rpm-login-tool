import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { safeStorage } = electron

export function encryptToBase64(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system (safeStorage).')
  }
  const buf = safeStorage.encryptString(plain)
  return buf.toString('base64')
}

export function decryptFromBase64(encBase64: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system (safeStorage).')
  }
  const buf = Buffer.from(encBase64, 'base64')
  return safeStorage.decryptString(buf)
}
