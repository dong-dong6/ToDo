import { deleteSetting, error, getSetting, json, readRequestJson, setSetting } from './db'
import type { Env } from './types'

const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const stored = await getSetting(env, 'password_hash')
  if (!stored) return false
  const [salt] = stored.split(':')
  const hash = await hashPassword(password, salt)
  return hash === stored.split(':')[1]
}

export async function getAuthStatus(env: Env, request: Request) {
  const stored = await getSetting(env, 'password_hash')
  const hasPassword = !!stored

  if (!hasPassword) {
    return json({ hasPassword: false, authenticated: true })
  }

  const token = extractToken(request)
  if (!token) {
    return json({ hasPassword: true, authenticated: false })
  }

  const sessionData = await getSetting(env, 'session_token')
  if (!sessionData) {
    return json({ hasPassword: true, authenticated: false })
  }

  const [storedToken, expiresAt] = sessionData.split(':')
  if (token !== storedToken || Date.now() > Number(expiresAt)) {
    await deleteSetting(env, 'session_token')
    return json({ hasPassword: true, authenticated: false })
  }

  return json({ hasPassword: true, authenticated: true })
}

export async function verify(request: Request, env: Env) {
  const body = await readRequestJson<{ password?: string }>(request)
  const password = body?.password

  if (!password) {
    return error('Password is required', 422)
  }

  const ok = await verifyPassword(env, password)
  if (!ok) {
    return error('Invalid password', 401)
  }

  const token = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TTL
  await setSetting(env, 'session_token', `${token}:${expiresAt}`)

  return json({ token, expiresAt })
}

export async function setPassword(request: Request, env: Env) {
  const existing = await getSetting(env, 'password_hash')
  if (existing) {
    return error('Password already set', 409)
  }

  const body = await readRequestJson<{ password?: string }>(request)
  const password = body?.password

  if (!password || password.length < 4) {
    return error('Password must be at least 4 characters', 422)
  }

  const salt = generateSalt()
  const hash = await hashPassword(password, salt)
  await setSetting(env, 'password_hash', `${salt}:${hash}`)

  const token = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TTL
  await setSetting(env, 'session_token', `${token}:${expiresAt}`)

  return json({ token, expiresAt })
}

export async function changePassword(request: Request, env: Env) {
  const body = await readRequestJson<{ oldPassword?: string; newPassword?: string }>(request)

  if (!body?.oldPassword || !body?.newPassword) {
    return error('Old and new passwords are required', 422)
  }

  if (body.newPassword.length < 4) {
    return error('New password must be at least 4 characters', 422)
  }

  const ok = await verifyPassword(env, body.oldPassword)
  if (!ok) {
    return error('Invalid old password', 401)
  }

  const salt = generateSalt()
  const hash = await hashPassword(body.newPassword, salt)
  await setSetting(env, 'password_hash', `${salt}:${hash}`)

  return json({ success: true })
}

export async function removePassword(request: Request, env: Env) {
  const body = await readRequestJson<{ password?: string }>(request)

  if (!body?.password) {
    return error('Password is required', 422)
  }

  const ok = await verifyPassword(env, body.password)
  if (!ok) {
    return error('Invalid password', 401)
  }

  await deleteSetting(env, 'password_hash')
  await deleteSetting(env, 'session_token')

  return json({ success: true })
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}
