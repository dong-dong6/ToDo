import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY_HASH = 'lock_password_hash'
const STORAGE_KEY_TIMEOUT = 'lock_timeout'
const SESSION_KEY_UNLOCKED = 'lock_unlocked'
const DEFAULT_TIMEOUT = 5 * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

const TIMEOUT_OPTIONS: { label: string; value: number }[] = [
  { label: '1 分钟', value: 60_000 },
  { label: '5 分钟', value: 300_000 },
  { label: '15 分钟', value: 900_000 },
  { label: '30 分钟', value: 1_800_000 },
  { label: '永不', value: 0 },
]

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

function getStoredHash(): string | null {
  return localStorage.getItem(STORAGE_KEY_HASH)
}

function getStoredTimeout(): number {
  const raw = localStorage.getItem(STORAGE_KEY_TIMEOUT)
  if (!raw) return DEFAULT_TIMEOUT
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TIMEOUT
}

function isSessionUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY_UNLOCKED) === '1'
}

function setSessionUnlocked(value: boolean) {
  if (value) {
    sessionStorage.setItem(SESSION_KEY_UNLOCKED, '1')
  } else {
    sessionStorage.removeItem(SESSION_KEY_UNLOCKED)
  }
}

export function useLock() {
  const [locked, setLocked] = useState(true)
  const [hasPassword, setHasPassword] = useState(() => !!getStoredHash())
  const [timeoutMs, setTimeoutMs] = useState(getStoredTimeout)
  const [showSettings, setShowSettings] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const unlockedRef = useRef(false)

  const doLock = useCallback(() => {
    if (!unlockedRef.current) return
    unlockedRef.current = false
    setSessionUnlocked(false)
    setLocked(true)
    setShowSettings(false)
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (timeoutMs > 0 && unlockedRef.current) {
      timerRef.current = setTimeout(doLock, timeoutMs)
    }
  }, [timeoutMs, doLock])

  useEffect(() => {
    if (!hasPassword) {
      unlockedRef.current = true
      setLocked(false)
      return
    }
    if (isSessionUnlocked()) {
      unlockedRef.current = true
      setLocked(false)
      resetTimer()
    }
  }, [hasPassword, resetTimer])

  useEffect(() => {
    if (locked) return

    const onActivity = () => resetTimer()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        doLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [locked, resetTimer, doLock])

  const unlock = useCallback(
    async (password: string): Promise<boolean> => {
      const stored = getStoredHash()
      if (!stored) return false
      const hash = await hashPassword(password)
      if (hash !== stored) return false
      unlockedRef.current = true
      setSessionUnlocked(true)
      setLocked(false)
      resetTimer()
      return true
    },
    [resetTimer],
  )

  const setPassword = useCallback(
    async (password: string) => {
      const hash = await hashPassword(password)
      localStorage.setItem(STORAGE_KEY_HASH, hash)
      setHasPassword(true)
      unlockedRef.current = true
      setSessionUnlocked(true)
      setLocked(false)
      resetTimer()
    },
    [resetTimer],
  )

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const stored = getStoredHash()
    if (!stored) return false
    const oldHash = await hashPassword(oldPassword)
    if (oldHash !== stored) return false
    const newHash = await hashPassword(newPassword)
    localStorage.setItem(STORAGE_KEY_HASH, newHash)
    return true
  }, [])

  const removePassword = useCallback(
    async (password: string): Promise<boolean> => {
      const stored = getStoredHash()
      if (!stored) return false
      const hash = await hashPassword(password)
      if (hash !== stored) return false
      localStorage.removeItem(STORAGE_KEY_HASH)
      setHasPassword(false)
      unlockedRef.current = true
      setSessionUnlocked(true)
      setLocked(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      return true
    },
    [],
  )

  const setTimeout_ = useCallback((ms: number) => {
    localStorage.setItem(STORAGE_KEY_TIMEOUT, String(ms))
    setTimeoutMs(ms)
  }, [])

  return {
    locked,
    hasPassword,
    timeoutMs,
    showSettings,
    setShowSettings,
    unlock,
    lock: doLock,
    setPassword,
    changePassword,
    removePassword,
    setTimeout: setTimeout_,
    TIMEOUT_OPTIONS,
  }
}
