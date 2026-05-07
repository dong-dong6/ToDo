import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'

const STORAGE_KEY_TOKEN = 'lock_token'
const STORAGE_KEY_TIMEOUT = 'lock_timeout'
const DEFAULT_TIMEOUT = 5 * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

const TIMEOUT_OPTIONS: { label: string; value: number }[] = [
  { label: '1 分钟', value: 60_000 },
  { label: '5 分钟', value: 300_000 },
  { label: '15 分钟', value: 900_000 },
  { label: '30 分钟', value: 1_800_000 },
  { label: '永不', value: 0 },
]

function getStoredToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY_TOKEN)
}

function storeToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY_TOKEN, token)
}

function clearToken() {
  sessionStorage.removeItem(STORAGE_KEY_TOKEN)
}

function getStoredTimeout(): number {
  const raw = localStorage.getItem(STORAGE_KEY_TIMEOUT)
  if (!raw) return DEFAULT_TIMEOUT
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TIMEOUT
}

export function useLock() {
  const [locked, setLocked] = useState(true)
  const [hasPassword, setHasPassword] = useState(false)
  const [checking, setChecking] = useState(true)
  const [timeoutMs, setTimeoutMs] = useState(getStoredTimeout)
  const [showSettings, setShowSettings] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const unlockedRef = useRef(false)

  const doLock = useCallback(() => {
    if (!unlockedRef.current) return
    unlockedRef.current = false
    clearToken()
    setLocked(true)
    setShowSettings(false)
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (timeoutMs > 0 && unlockedRef.current) {
      timerRef.current = setTimeout(doLock, timeoutMs)
    }
  }, [timeoutMs, doLock])

  // Check auth status on mount
  useEffect(() => {
    const token = getStoredToken()
    api.getAuthStatus(token).then((status) => {
      setHasPassword(status.hasPassword)
      if (status.authenticated) {
        unlockedRef.current = true
        setLocked(false)
        resetTimer()
      }
      setChecking(false)
    }).catch(() => {
      setChecking(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Activity listeners
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
      try {
        const { token } = await api.authVerify(password)
        storeToken(token)
        unlockedRef.current = true
        setLocked(false)
        resetTimer()
        return true
      } catch {
        return false
      }
    },
    [resetTimer],
  )

  const setPassword = useCallback(
    async (password: string) => {
      const { token } = await api.authSetPassword(password)
      storeToken(token)
      setHasPassword(true)
      unlockedRef.current = true
      setLocked(false)
      resetTimer()
    },
    [resetTimer],
  )

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    try {
      await api.authChangePassword(oldPassword, newPassword)
      return true
    } catch {
      return false
    }
  }, [])

  const removePassword = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        await api.authRemovePassword(password)
        clearToken()
        setHasPassword(false)
        unlockedRef.current = true
        setLocked(false)
        if (timerRef.current) clearTimeout(timerRef.current)
        return true
      } catch {
        return false
      }
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
    checking,
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
