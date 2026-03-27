const { mkdir, rm, writeFile, cp, readFile } = require('node:fs/promises')
const { join, basename } = require('node:path')
const { tmpdir } = require('node:os')
const { randomBytes, scryptSync, createCipheriv, createDecipheriv } = require('node:crypto')
const AdmZip = require('adm-zip')

const EXPORT_VERSION = 1

function deriveKey(password, salt) {
  return scryptSync(password, salt, 32)
}

function encryptString(plain, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const content = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    content: content.toString('base64')
  }
}

function decryptString(payload, key) {
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const content = Buffer.from(payload.content, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(content), decipher.final()])
  return plain.toString('utf8')
}

async function stripCacheFolders(profileDir) {
  const cacheDirs = [
    'Default/Cache',
    'Default/Code Cache',
    'Default/GPUCache',
    'Default/Service Worker/CacheStorage',
    'Default/Service Worker/ScriptCache'
  ]

  await Promise.all(cacheDirs.map((rel) => rm(join(profileDir, rel), { recursive: true, force: true })))
}

async function exportData({ input, deps }) {
  const password = input.password && input.password.trim()
  if (!password) throw new Error('Password is required for export')

  const db = deps.getDb()
  const profileIds = input.profileIds
  const proxyIds = input.proxyIds

  if (profileIds.length === 0 && proxyIds.length === 0) {
    throw new Error('Select at least one profile or proxy to export')
  }

  const exportRoot = join(tmpdir(), String(Date.now()))
  const profilesDir = join(exportRoot, 'profiles')

  await mkdir(profilesDir, { recursive: true })

  const salt = randomBytes(16)
  const key = deriveKey(password, salt)

  const profilePlaceholders = profileIds.map(() => '?').join(',')
  const selectedProfiles = profileIds.length
    ? db.prepare('SELECT * FROM profiles WHERE id IN (' + profilePlaceholders + ')').all(...profileIds)
    : []

  const proxyPlaceholders = proxyIds.map(() => '?').join(',')
  const selectedProxies = proxyIds.length
    ? db.prepare('SELECT * FROM proxies WHERE id IN (' + proxyPlaceholders + ')').all(...proxyIds)
    : []

  const selectedProxyIds = new Set(selectedProxies.map((p) => p.id))

  const profilesManifest = []
  for (const profile of selectedProfiles) {
    const folderName = profile.id
    const sourceDir = profile.userDataDir
    const targetDir = join(profilesDir, folderName)

    await cp(sourceDir, targetDir, { recursive: true })
    if (!input.includeCache) {
      await stripCacheFolders(targetDir)
    }

    profilesManifest.push({
      id: profile.id,
      name: profile.name,
      tags: profile.tags ?? null,
      notes: profile.notes ?? null,
      proxyId: selectedProxyIds.has(profile.proxyId) ? profile.proxyId : null,
      createdAt: profile.createdAt,
      folder: 'profiles/' + folderName
    })
  }

  const proxiesManifest = selectedProxies.map((proxy) => {
    const passwordPlain = proxy.passwordEnc ? deps.decryptFromBase64(proxy.passwordEnc) : null
    return {
      id: proxy.id,
      label: proxy.label,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username ?? null,
      passwordCipher: passwordPlain ? encryptString(passwordPlain, key) : null,
      createdAt: proxy.createdAt
    }
  })

  const totpPlaceholders = profileIds.map(() => '?').join(',')
  const totpRows = profileIds.length
    ? db.prepare('SELECT * FROM totp_secrets WHERE profileId IN (' + totpPlaceholders + ')').all(...profileIds)
    : []

  const totpManifest = totpRows.map((row) => {
    const secret = deps.decryptFromBase64(row.secretEnc)
    return {
      profileId: row.profileId,
      issuer: row.issuer ?? null,
      accountName: row.accountName ?? null,
      secretCipher: encryptString(secret, key),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  })

  const manifest = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    includeCache: input.includeCache,
    crypto: { salt: salt.toString('base64') },
    profiles: profilesManifest,
    proxies: proxiesManifest,
    totp: totpManifest
  }

  await writeFile(join(exportRoot, 'export.json'), JSON.stringify(manifest, null, 2), 'utf8')

  const zip = new AdmZip()
  zip.addLocalFolder(exportRoot)
  zip.writeZip(input.outputPath)

  await rm(exportRoot, { recursive: true, force: true })

  deps.audit('data:export', {
    profiles: profilesManifest.length,
    proxies: proxiesManifest.length,
    includeCache: input.includeCache,
    fileName: basename(input.outputPath)
  })

  return { path: input.outputPath }
}

async function importData({ input, deps }) {
  const password = input.password && input.password.trim()
  if (!password) throw new Error('Password is required for import')

  const zipPath = input.zipPath
  const importRoot = join(tmpdir(), String(Date.now()))

  await mkdir(importRoot, { recursive: true })

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(importRoot, true)

  const manifestPath = join(importRoot, 'export.json')
  const manifestText = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestText)

  if (manifest.version !== EXPORT_VERSION) {
    throw new Error('Unsupported export version: ' + manifest.version)
  }

  const salt = Buffer.from(manifest.crypto.salt, 'base64')
  const key = deriveKey(password, salt)

  const db = deps.getDb()

  const proxyIdMap = new Map()
  for (const proxy of manifest.proxies) {
    const newId = deps.uuidv4()
    proxyIdMap.set(proxy.id, newId)

    const passwordPlain = proxy.passwordCipher ? decryptString(proxy.passwordCipher, key) : null
    const passwordEnc = passwordPlain ? deps.encryptToBase64(passwordPlain) : null

    db.prepare(
      'INSERT INTO proxies (id, label, type, host, port, username, passwordEnc, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(newId, proxy.label, proxy.type, proxy.host, proxy.port, proxy.username ?? null, passwordEnc, proxy.createdAt)
  }

  const profileIdMap = new Map()

  await deps.ensureProfilesRoot()

  for (const profile of manifest.profiles) {
    const newId = deps.uuidv4()
    profileIdMap.set(profile.id, newId)

    const userDataDir = join(deps.getProfilesRoot(), newId)
    const sourceDir = join(importRoot, profile.folder)

    await mkdir(userDataDir, { recursive: true })
    await cp(sourceDir, userDataDir, { recursive: true })

    const newProxyId = profile.proxyId ? proxyIdMap.get(profile.proxyId) ?? null : null

    db.prepare(
      'INSERT INTO profiles (id, name, tags, notes, userDataDir, proxyId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(newId, profile.name, profile.tags ?? null, profile.notes ?? null, userDataDir, newProxyId, profile.createdAt)
  }

  for (const totp of manifest.totp) {
    const newProfileId = profileIdMap.get(totp.profileId)
    if (!newProfileId) continue

    const secretPlain = decryptString(totp.secretCipher, key)
    const secretEnc = deps.encryptToBase64(secretPlain)

    db.prepare(
      'INSERT INTO totp_secrets (profileId, issuer, accountName, secretEnc, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(profileId) DO UPDATE SET issuer=excluded.issuer, accountName=excluded.accountName, ' +
        'secretEnc=excluded.secretEnc, updatedAt=excluded.updatedAt'
    ).run(newProfileId, totp.issuer ?? null, totp.accountName ?? null, secretEnc, totp.createdAt, totp.updatedAt)
  }

  await rm(importRoot, { recursive: true, force: true })

  deps.audit('data:import', {
    profiles: manifest.profiles.length,
    proxies: manifest.proxies.length,
    fileName: basename(zipPath)
  })

  return {
    profiles: manifest.profiles.length,
    proxies: manifest.proxies.length
  }
}

module.exports = { exportData, importData }
