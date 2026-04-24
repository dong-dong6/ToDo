import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { createTodo, deleteAttachment, deleteTodo, getTodos, updateTodo, uploadAttachment } from './lib/api'
import type { Priority, Todo, TodoAttachment, TodoFilter, TodoResponse } from './lib/types'

const initialForm = {
  title: '',
  notes: '',
  priority: 'medium' as Priority,
  dueDate: '',
}

const priorityTone: Record<Priority, string> = {
  low: 'bg-white/80 text-ink',
  medium: 'bg-sand text-ink',
  high: 'bg-clay text-white',
}

function normalizeDateKey(value: string | null) {
  if (!value) {
    return 'no-date'
  }

  return value.slice(0, 10)
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return '未安排日期'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function compareDateKeys(a: string, b: string) {
  if (a === 'no-date' && b === 'no-date') {
    return 0
  }

  if (a === 'no-date') {
    return 1
  }

  if (b === 'no-date') {
    return -1
  }

  return a.localeCompare(b)
}

function buildTimeline(todos: Todo[]) {
  const groups = new Map<string, Todo[]>()

  for (const todo of todos) {
    const key = normalizeDateKey(todo.dueDate)
    const list = groups.get(key) ?? []
    list.push(todo)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareDateKeys(left, right))
    .map(([key, items]) => ({
      key,
      label: key === 'no-date' ? '未安排日期' : formatDateLabel(key),
      items: items.sort((left, right) => {
        if (left.priority !== right.priority) {
          const rank = { high: 0, medium: 1, low: 2 }
          return rank[left.priority] - rank[right.priority]
        }

        return left.createdAt.localeCompare(right.createdAt)
      }),
    }))
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border-2 border-line bg-white px-4 py-4 shadow-stamp">
      <p className="text-xs tracking-[0.24em] text-smoke">{props.label}</p>
      <p className="mt-3 text-3xl font-bold leading-none text-ink">{props.value}</p>
    </div>
  )
}

function FilterTabs(props: { value: TodoFilter; onChange: (value: TodoFilter) => void }) {
  const items: Array<{ value: TodoFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'open', label: '待完成' },
    { value: 'done', label: '已完成' },
  ]

  return (
    <div className="inline-flex flex-wrap rounded-full border-2 border-line bg-white p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => props.onChange(item.value)}
          className={[
            'rounded-full px-4 py-2 text-sm font-medium transition',
            props.value === item.value ? 'bg-ink text-paper' : 'text-smoke hover:text-ink',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function AttachmentList(props: {
  attachments: TodoAttachment[]
  completed: boolean
  busy: boolean
  uploading: boolean
  onUpload: (todo: Todo, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDelete: (todo: Todo, attachment: TodoAttachment) => Promise<void>
  todo: Todo
}) {
  return (
    <div className="mt-4 rounded-[18px] border border-dashed border-line bg-[#fcfaf5] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-smoke">
          {props.attachments.length > 0
            ? `附件 ${props.attachments.length} 个`
            : '暂无附件'}
        </p>

        {!props.completed && (
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand">
            {props.uploading ? '上传中...' : '上传附件'}
            <input
              type="file"
              className="hidden"
              disabled={props.busy || props.uploading}
              onChange={(event) => void props.onUpload(props.todo, event)}
            />
          </label>
        )}
      </div>

      {props.attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {props.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-col gap-2 rounded-[16px] border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {attachment.fileName}
                </a>
                <p className="mt-1 text-xs text-smoke">
                  {formatBytes(attachment.sizeBytes)} · {formatDateTime(attachment.createdAt)}
                </p>
              </div>

              {!props.completed && (
                <button
                  type="button"
                  disabled={props.busy}
                  onClick={() => void props.onDelete(props.todo, attachment)}
                  className="rounded-full border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
                >
                  删除附件
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TodoItem(props: {
  todo: Todo
  busy: boolean
  compact?: boolean
  uploading: boolean
  onToggle: (todo: Todo) => Promise<void>
  onEdit?: (todo: Todo) => void
  onDelete: (id: string) => Promise<void>
  onUpload: (todo: Todo, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDeleteAttachment: (todo: Todo, attachment: TodoAttachment) => Promise<void>
}) {
  return (
    <article className="rounded-[24px] border-2 border-line bg-white p-4 shadow-stamp">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex gap-4">
            <button
              type="button"
              aria-label={props.todo.completed ? '恢复为待办' : '标记为完成'}
              disabled={props.busy}
              onClick={() => void props.onToggle(props.todo)}
              className={[
                'mt-1 h-6 w-6 shrink-0 rounded-full border-2 border-line transition',
                props.todo.completed ? 'bg-moss' : 'bg-paper',
              ].join(' ')}
            >
              <span className="sr-only">toggle</span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">{props.todo.title}</h3>
                <span
                  className={[
                    'rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.18em]',
                    priorityTone[props.todo.priority],
                  ].join(' ')}
                >
                  {props.todo.priority === 'high'
                    ? '高'
                    : props.todo.priority === 'medium'
                      ? '中'
                      : '低'}
                </span>
                <span className="rounded-full border border-dashed border-line px-3 py-1 text-[11px] tracking-[0.18em] text-smoke">
                  {formatDateLabel(props.todo.dueDate)}
                </span>
              </div>

              {!props.compact && props.todo.notes && (
                <p className="mt-3 text-sm leading-6 text-smoke">{props.todo.notes}</p>
              )}

              {props.compact && props.todo.completedAt && (
                <p className="mt-3 text-sm text-smoke">
                  完成于 {formatDateTime(props.todo.completedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {!props.compact && !props.todo.completed && props.onEdit && (
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onEdit?.(props.todo)}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
              >
                编辑
              </button>
            )}

            <button
              type="button"
              disabled={props.busy}
              onClick={() => void props.onDelete(props.todo.id)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </div>

        <AttachmentList
          attachments={props.todo.attachments}
          completed={props.todo.completed}
          busy={props.busy}
          uploading={props.uploading}
          onUpload={props.onUpload}
          onDelete={props.onDeleteAttachment}
          todo={props.todo}
        />
      </div>
    </article>
  )
}

function TimelineGroup(props: {
  label: string
  items: Todo[]
  busyId: string | null
  uploadingId: string | null
  onToggle: (todo: Todo) => Promise<void>
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => Promise<void>
  onUpload: (todo: Todo, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDeleteAttachment: (todo: Todo, attachment: TodoAttachment) => Promise<void>
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[128px_1fr] xl:gap-5">
      <div className="xl:sticky xl:top-5 xl:self-start">
        <div className="rounded-[20px] border-2 border-line bg-[#fff8ef] px-4 py-4">
          <p className="text-xs tracking-[0.22em] text-smoke">日期</p>
          <h3 className="mt-2 text-lg font-bold text-ink">{props.label}</h3>
          <p className="mt-1 text-xs text-smoke">{props.items.length} 项</p>
        </div>
      </div>

      <div className="space-y-4">
        {props.items.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            busy={props.busyId === todo.id}
            uploading={props.uploadingId === todo.id}
            onToggle={props.onToggle}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
            onUpload={props.onUpload}
            onDeleteAttachment={props.onDeleteAttachment}
          />
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [data, setData] = useState<TodoResponse | null>(null)
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)

  function resetForm() {
    setForm(initialForm)
    setEditingTodoId(null)
  }

  async function refresh() {
    setLoading(true)
    setError(null)

    try {
      const result = await getTodos()
      setData(result)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载待办失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const openTodos = useMemo(() => data?.todos.filter((todo) => !todo.completed) ?? [], [data])
  const doneTodos = useMemo(
    () => (data?.todos.filter((todo) => todo.completed) ?? []).sort((a, b) => {
      const left = a.completedAt ?? a.updatedAt
      const right = b.completedAt ?? b.updatedAt
      return right.localeCompare(left)
    }),
    [data],
  )

  const visibleOpenTodos = useMemo(() => {
    if (filter === 'done') {
      return []
    }

    return openTodos
  }, [filter, openTodos])

  const visibleDoneTodos = useMemo(() => {
    if (filter === 'open') {
      return []
    }

    return doneTodos
  }, [filter, doneTodos])

  const timeline = useMemo(() => buildTimeline(visibleOpenTodos), [visibleOpenTodos])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.title.trim()) {
      setError('请输入任务标题')
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const isEditing = editingTodoId !== null

      if (isEditing) {
        await updateTodo(editingTodoId, {
          title: form.title.trim(),
          notes: form.notes.trim(),
          priority: form.priority,
          dueDate: form.dueDate,
        })
      } else {
        await createTodo({
          title: form.title.trim(),
          notes: form.notes.trim(),
          priority: form.priority,
          dueDate: form.dueDate,
        })
      }
      resetForm()
      await refresh()
      setNotice(isEditing ? '任务已更新。' : '任务已创建。')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : editingTodoId
            ? '更新任务失败'
            : '创建任务失败',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(todo: Todo) {
    if (todo.completed) {
      return
    }

    setEditingTodoId(todo.id)
    setForm({
      title: todo.title,
      notes: todo.notes,
      priority: todo.priority,
      dueDate: todo.dueDate ?? '',
    })
    setError(null)
    setNotice('正在编辑任务。')
  }

  async function handleToggle(todo: Todo) {
    setBusyId(todo.id)
    setError(null)
    setNotice(null)

    try {
      await updateTodo(todo.id, { completed: !todo.completed })
      if (!todo.completed && editingTodoId === todo.id) {
        resetForm()
      }
      await refresh()
      if (!todo.completed) {
        setNotice('任务已完成。')
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '更新任务失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    setError(null)
    setNotice(null)

    try {
      await deleteTodo(id)
      if (editingTodoId === id) {
        resetForm()
      }
      await refresh()
      setNotice('任务已删除。')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除任务失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUpload(todo: Todo, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setUploadingId(todo.id)
    setError(null)
    setNotice(null)

    try {
      await uploadAttachment(todo.id, file)
      await refresh()
      setNotice(`附件已上传：${file.name}`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '附件上传失败')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleDeleteAttachment(todo: Todo, attachment: TodoAttachment) {
    setBusyId(todo.id)
    setError(null)
    setNotice(null)

    try {
      await deleteAttachment(attachment.id)
      await refresh()
      setNotice(`附件已删除：${attachment.fileName}`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除附件失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-3 md:px-4 xl:px-5">
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
          <aside className="flex flex-col gap-4 xl:sticky xl:top-3">
            <section className="rounded-[28px] border-2 border-line bg-white p-5 shadow-stamp">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.22em] text-smoke">
                    {editingTodoId ? '编辑任务' : '新建任务'}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-ink">ToDo</h1>
                </div>
                {editingTodoId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-paper"
                  >
                    取消
                  </button>
                )}
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="任务标题"
                  className="w-full rounded-[18px] border-2 border-line bg-paper px-4 py-3 text-base outline-none transition focus:bg-white"
                />

                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="备注"
                  className="w-full rounded-[18px] border-2 border-line bg-paper px-4 py-3 text-sm outline-none transition focus:bg-white"
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as Priority,
                      }))
                    }
                    className="w-full rounded-[18px] border-2 border-line bg-paper px-4 py-3 text-sm outline-none transition focus:bg-white"
                  >
                    <option value="low">低优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="high">高优先级</option>
                  </select>

                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    className="w-full rounded-[18px] border-2 border-line bg-paper px-4 py-3 text-sm outline-none transition focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-[18px] border-2 border-line bg-clay px-4 py-3 text-sm font-bold tracking-[0.2em] text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? '保存中...' : editingTodoId ? '保存修改' : '创建任务'}
                </button>
              </form>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <StatCard label="总任务" value={data?.stats.total ?? 0} />
              <StatCard label="待完成" value={data?.stats.open ?? 0} />
              <StatCard label="已完成" value={data?.stats.done ?? 0} />
              <StatCard label="高优先级" value={data?.stats.urgent ?? 0} />
            </section>
          </aside>

          <section className="rounded-[28px] border-2 border-line bg-[#f3eadb] p-4 shadow-stamp md:p-5">
            <div className="flex flex-col gap-4 border-b-2 border-dashed border-line pb-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <FilterTabs value={filter} onChange={setFilter} />
                <span className="rounded-full border border-dashed border-line px-3 py-2 text-xs text-smoke">
                  列表区
                </span>
              </div>

              {(error || notice) && (
                <div
                  className={[
                    'rounded-[18px] border px-4 py-2 text-sm',
                    error
                      ? 'border-clay bg-[#fff4ee] text-[#8a3f1f]'
                      : 'border-moss bg-[#f2f6ee] text-[#405131]',
                  ].join(' ')}
                >
                  {error ?? notice}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-6">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-[24px] border-2 border-line bg-white/80"
                  />
                ))
              ) : timeline.length > 0 ? (
                timeline.map((group) => (
                  <TimelineGroup
                    key={group.key}
                    label={group.label}
                    items={group.items}
                    busyId={busyId}
                    uploadingId={uploadingId}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onUpload={handleUpload}
                    onDeleteAttachment={handleDeleteAttachment}
                  />
                ))
              ) : filter === 'done' ? null : (
                <div className="rounded-[24px] border-2 border-dashed border-line bg-white px-6 py-12 text-center">
                  <p className="text-sm text-smoke">当前没有待完成任务</p>
                </div>
              )}

              {visibleDoneTodos.length > 0 && (
                <section className="rounded-[24px] border-2 border-line bg-[#edf2e6] p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-ink">已完成</h2>
                      <span className="text-sm text-smoke">{visibleDoneTodos.length}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCompletedExpanded((current) => !current)}
                      className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
                    >
                      {completedExpanded ? '收起' : '展开'}
                    </button>
                  </div>

                  {completedExpanded && (
                    <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                      {visibleDoneTodos.map((todo) => (
                        <TodoItem
                          key={todo.id}
                          todo={todo}
                          busy={busyId === todo.id}
                          compact
                          uploading={false}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onUpload={handleUpload}
                          onDeleteAttachment={handleDeleteAttachment}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
