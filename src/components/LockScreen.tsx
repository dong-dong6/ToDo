import { FormEvent, useState } from 'react'

export function LockScreen(props: {
  hasPassword: boolean
  checking: boolean
  onUnlock: (password: string) => Promise<boolean>
  onSetPassword: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleUnlock(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError('')
    const ok = await props.onUnlock(password)
    setBusy(false)
    if (!ok) {
      setError('密码错误')
      setPassword('')
    }
  }

  async function handleSetup(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    if (password.length < 4) {
      setError('密码至少 4 个字符')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError('')
    await props.onSetPassword(password)
    setBusy(false)
  }

  if (props.checking) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-ink">ToDo</h1>
          <p className="mt-4 text-sm text-smoke">验证中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ink">ToDo</h1>
          <p className="mt-2 text-sm text-smoke">
            {props.hasPassword ? '输入密码以继续' : '首次使用，请设置密码'}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={props.hasPassword ? handleUnlock : handleSetup}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-smoke">
              {props.hasPassword ? '密码' : '设置密码'}
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="输入密码"
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:bg-paper"
            />
          </div>

          {!props.hasPassword && (
            <div>
              <label className="mb-1 block text-xs font-medium text-smoke">确认密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  setError('')
                }}
                placeholder="再次输入密码"
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:bg-paper"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-clay">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg border border-line bg-clay px-4 py-2.5 text-sm font-bold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '验证中...' : props.hasPassword ? '解锁' : '确认'}
          </button>
        </form>
      </div>
    </div>
  )
}
