import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/db'

export function audit(action: string, payload?: unknown) {
  const db = getDb()
  db.prepare('INSERT INTO audit_logs (id, action, payloadJson, createdAt) VALUES (?, ?, ?, ?)').run(
    uuidv4(),
    action,
    payload ? JSON.stringify(payload) : null,
    new Date().toISOString()
  )
}
