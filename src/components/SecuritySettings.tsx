import { FormEvent, useState } from 'react'

export function SecuritySettings(props: {
  hasPassword: boolean
  timeoutMs: number
  timeoutOptions: { label: string; value: number }[]
  onClose: () => void
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<boolean>
  onRemovePassword: (password: string) => Promise<boolean>
  onSetTimeout: (ms: number) => void
}) {
  const [tab, setTab] = useState<'password' | 'timeout'>('password')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [removePwd, setRemovePwd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!oldPwd || !newPwd) return
    if (newPwd.length < 4) {
      setError('新密码至少 4 个字符')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('两次输入的新密码不一致')
      return
    }
    setBusy(true)
    const ok = await props.onChangePassword(oldPwd, newPwd)
    setBusy(false)
    if (ok) {
      setSuccess('密码已修改')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } else {
      setError('原密码错误')
    }
  }

  async function handleRemovePassword(e: FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!removePwd) return
    setBusy(true)
    const ok = await props.onRemovePassword(removePwd)
    setBusy(false)
    if (ok) {
      setSuccess('密码保护已关闭')
      setRemovePwd('')
    } else {
      setError('密码错误')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-ink/40 flex items-center justify-center px-3">
      <div className="w-full max-w-md rounded-lg border-2 border-line bg-paper shadow-stamp">
        <div className="flex items-center justify-between border-b-2 border-dashed border-line p-4">
          <h2 className="text-lg font-bold text-ink">安全设置</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
          >
            关闭
          </button>
        </div>

        <div className="flex border-b border-line">
          <button
            type="button"
            onClick={() => { setTab('password'); clearMessages() }}
            className={[
              'flex-1 px-4 py-2.5 text-sm font-medium transition',
              tab === 'password' ? 'border-b-2 border-clay text-ink' : 'text-smoke hover:text-ink',
            ].join(' ')}
          >
            密码管理
          </button>
          <button
            type="button"
            onClick={() => { setTab('timeout'); clearMessages() }}
            className={[
              'flex-1 px-4 py-2.5 text-sm font-medium transition',
              tab === 'timeout' ? 'border-b-2 border-clay text-ink' : 'text-smoke hover:text-ink',
            ].join(' ')}
          >
            自动锁定
          </button>
        </div>

        <div className="p-4">
          {tab === 'password' && (
            <div className="space-y-5">
              {props.hasPassword ? (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <p className="text-xs font-medium text-smoke">修改密码</p>
                  <input
                    type="password"
                    value={oldPwd}
                    onChange={(e) => { setOldPwd(e.target.value); clearMessages() }}
                    placeholder="当前密码"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:bg-paper"
                  />
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => { setNewPwd(e.target.value); clearMessages() }}
                    placeholder="新密码"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:bg-paper"
                  />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => { setConfirmPwd(e.target.value); clearMessages() }}
                    placeholder="确认新密码"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:bg-paper"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg border border-line bg-clay px-4 py-2 text-sm font-bold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? '保存中...' : '修改密码'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-smoke">当前未设置密码保护。</p>
              )}

              {props.hasPassword && (
                <div className="border-t border-dashed border-line pt-4">
                  <form onSubmit={handleRemovePassword} className="space-y-3">
                    <p className="text-xs font-medium text-smoke">关闭密码保护</p>
                    <input
                      type="password"
                      value={removePwd}
                      onChange={(e) => { setRemovePwd(e.target.value); clearMessages() }}
                      placeholder="输入当前密码以关闭"
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:bg-paper"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? '验证中...' : '关闭密码保护'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {tab === 'timeout' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-smoke">无操作后自动锁定</p>
              <div className="space-y-2">
                {props.timeoutOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition',
                      props.timeoutMs === opt.value
                        ? 'border-clay bg-[#fff4ee] text-ink'
                        : 'border-line bg-white text-smoke hover:text-ink',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="timeout"
                      checked={props.timeoutMs === opt.value}
                      onChange={() => props.onSetTimeout(opt.value)}
                      className="accent-clay"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-smoke">
                切换到其他标签页时会立即锁定。
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-clay">{error}</p>}
          {success && <p className="mt-3 text-sm text-moss">{success}</p>}
        </div>
      </div>
    </div>
  )
}
