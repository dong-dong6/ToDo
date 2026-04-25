import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createTodo, deleteAttachment, deleteTodo, getTodos, updateTodo, uploadAttachment } from './lib/api'
import type { Todo, TodoAttachment, TodoResponse } from './lib/types'

const initialForm = {
  title: '',
  notes: '',
  tagInput: '',
  tags: [] as string[],
  dueDate: '',
}

const tagTones = [
  'bg-sand text-ink',
  'bg-[#edf2e6] text-[#405131]',
  'bg-[#fff4ee] text-[#8a3f1f]',
  'bg-white/80 text-ink',
]

function toLocalDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatTaskDateLabel(value: string) {
  const today = toLocalDateKey(new Date())
  const dateText = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateFromKey(value))

  if (value === today) {
    return `今天 · ${dateText}`
  }

  return dateText
}

function formatDeadlineLabel(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateFromKey(value))
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

function formatSelectedFiles(files: File[]) {
  if (files.length === 0) {
    return '未选择附件'
  }

  if (files.length === 1) {
    return files[0].name
  }

  return `${files.length} 个附件`
}

function normalizeTag(value: string) {
  return value.trim().slice(0, 24)
}

function tagTone(index: number) {
  return tagTones[index % tagTones.length]
}

function buildTimeline(todos: Todo[]) {
  const groups = new Map<string, Todo[]>()

  for (const todo of todos) {
    const key = toLocalDateKey(todo.createdAt)
    const list = groups.get(key) ?? []
    list.push(todo)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => ({
      key,
      label: formatTaskDateLabel(key),
      items: items.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }))
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="stat-item">
      <p className="text-[11px] font-medium text-smoke">{props.label}</p>
      <p className="mt-1 text-xl font-bold leading-none text-ink">{props.value}</p>
    </div>
  )
}

function AttachmentList(props: {
  attachments: TodoAttachment[]
  completed: boolean
  busy: boolean
  onDelete: (todo: Todo, attachment: TodoAttachment) => Promise<void>
  todo: Todo
}) {
  if (props.attachments.length === 0) {
    return null
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-line bg-[#fcfaf5] p-2">
      {props.attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex flex-col gap-2 rounded-md border border-line bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
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
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              删除
            </button>
          )}
        </div>
      ))}
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
  const deadlineLabel = formatDeadlineLabel(props.todo.dueDate)

  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-soft">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              aria-label={props.todo.completed ? '恢复为待办' : '标记为完成'}
              disabled={props.busy}
              onClick={() => void props.onToggle(props.todo)}
              className={[
                'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-line transition',
                props.todo.completed ? 'bg-moss' : 'bg-paper',
              ].join(' ')}
            >
              <span className="sr-only">toggle</span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold leading-6 text-ink">{props.todo.title}</h3>
                {props.todo.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className={[
                      'rounded-md px-2 py-1 text-[11px] font-semibold',
                      tagTone(index),
                    ].join(' ')}
                  >
                    {tag}
                  </span>
                ))}
                {deadlineLabel && (
                  <span className="rounded-md border border-dashed border-line px-2 py-1 text-[11px] text-smoke">
                    DDL {deadlineLabel}
                  </span>
                )}
              </div>

              {!props.compact && props.todo.notes && (
                <p className="mt-2 text-sm leading-6 text-smoke">{props.todo.notes}</p>
              )}

              {props.compact && props.todo.completedAt && (
                <p className="mt-2 text-sm text-smoke">
                  完成于 {formatDateTime(props.todo.completedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {!props.compact && !props.todo.completed && (
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-sand">
                {props.uploading ? '上传中...' : '附件'}
                <input
                  type="file"
                  className="hidden"
                  disabled={props.busy || props.uploading}
                  onChange={(event) => void props.onUpload(props.todo, event)}
                />
              </label>
            )}

            {!props.compact && !props.todo.completed && props.onEdit && (
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onEdit?.(props.todo)}
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
              >
                编辑
              </button>
            )}

            <button
              type="button"
              disabled={props.busy}
              onClick={() => void props.onDelete(props.todo.id)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </div>

        <AttachmentList
          attachments={props.todo.attachments}
          completed={props.todo.completed}
          busy={props.busy}
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
  collapsed: boolean
  busyId: string | null
  uploadingId: string | null
  onToggleGroup: () => void
  onToggle: (todo: Todo) => Promise<void>
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => Promise<void>
  onUpload: (todo: Todo, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDeleteAttachment: (todo: Todo, attachment: TodoAttachment) => Promise<void>
}) {
  return (
    <section className="rounded-lg border border-line bg-[#fffaf4] shadow-soft">
      <button
        type="button"
        onClick={props.onToggleGroup}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/50"
      >
        <div>
          <p className="text-[11px] font-medium text-smoke">任务日期</p>
          <h3 className="mt-1 text-base font-bold leading-5 text-ink">{props.label}</h3>
        </div>
        <span className="shrink-0 rounded-md border border-line bg-white px-3 py-1.5 text-xs text-smoke">
          {props.collapsed ? '展开' : '收起'} · {props.items.length} 项
        </span>
      </button>

      {!props.collapsed && (
        <div className="space-y-3 border-t-2 border-dashed border-line p-3">
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
      )}
    </section>
  )
}

function CompletedGroupTrigger(props: { count: number; onOpen: () => void }) {
  return (
    <section className="rounded-lg border border-line bg-[#fffaf4] shadow-soft">
      <button
        type="button"
        onClick={props.onOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/50"
      >
        <div>
          <p className="text-[11px] font-medium text-smoke">任务状态</p>
          <h3 className="mt-1 text-base font-bold leading-5 text-ink">已完成</h3>
        </div>
        <span className="shrink-0 rounded-md border border-line bg-white px-3 py-1.5 text-xs text-smoke">
          查看 · {props.count} 项
        </span>
      </button>
    </section>
  )
}

function CompletedTaskModal(props: {
  todos: Todo[]
  dateValue: string
  searchValue: string
  busyId: string | null
  uploadingId: string | null
  onDateChange: (value: string) => void
  onSearchChange: (value: string) => void
  onClose: () => void
  onToggle: (todo: Todo) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpload: (todo: Todo, event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDeleteAttachment: (todo: Todo, attachment: TodoAttachment) => Promise<void>
}) {
  const dateOptions = Array.from(
    new Set(props.todos.map((todo) => toLocalDateKey(todo.completedAt ?? todo.updatedAt))),
  ).sort((left, right) => right.localeCompare(left))
  const search = props.searchValue.trim().toLowerCase()
  const visibleTodos = props.todos.filter((todo) => {
    const dateKey = toLocalDateKey(todo.completedAt ?? todo.updatedAt)
    const matchesDate = props.dateValue === '' || props.dateValue === dateKey
    const text = [todo.title, todo.notes, ...todo.tags].join(' ').toLowerCase()

    return matchesDate && (!search || text.includes(search))
  })

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 px-3 py-6">
      <div className="mx-auto flex max-h-full w-full max-w-4xl flex-col rounded-lg border-2 border-line bg-paper shadow-stamp">
        <div className="flex flex-col gap-3 border-b-2 border-dashed border-line p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium text-smoke">已完成任务</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{visibleTodos.length} 项</h2>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-3 border-b-2 border-dashed border-line p-4 md:grid-cols-[180px_1fr]">
          <select
            value={props.dateValue}
            onChange={(event) => props.onDateChange(event.target.value)}
            className="w-full rounded-lg border-2 border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:bg-paper"
          >
            <option value="">全部日期</option>
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {formatTaskDateLabel(date)}
              </option>
            ))}
          </select>

          <input
            value={props.searchValue}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="搜索任务内容或标签"
            className="w-full rounded-lg border-2 border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:bg-paper"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {visibleTodos.length > 0 ? (
            visibleTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                busy={props.busyId === todo.id}
                compact
                uploading={props.uploadingId === todo.id}
                onToggle={props.onToggle}
                onDelete={props.onDelete}
                onUpload={props.onUpload}
                onDeleteAttachment={props.onDeleteAttachment}
              />
            ))
          ) : (
            <div className="rounded-lg border-2 border-dashed border-line bg-white px-6 py-10 text-center">
              <p className="text-sm text-smoke">没有匹配的已完成任务</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<TodoResponse | null>(null)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [formFiles, setFormFiles] = useState<File[]>([])
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [completedModalOpen, setCompletedModalOpen] = useState(false)
  const [completedDate, setCompletedDate] = useState('')
  const [completedSearch, setCompletedSearch] = useState('')
  const formFileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setForm(initialForm)
    setFormFiles([])
    setEditingTodoId(null)
    if (formFileInputRef.current) {
      formFileInputRef.current.value = ''
    }
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

  const timeline = useMemo(() => buildTimeline(openTodos), [openTodos])

  function toggleDateGroup(dateKey: string) {
    setCollapsedDates((current) => {
      const next = new Set(current)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

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
      let savedTodo: Todo

      if (isEditing) {
        savedTodo = await updateTodo(editingTodoId, {
          title: form.title.trim(),
          notes: form.notes.trim(),
          tags: form.tags,
          dueDate: form.dueDate,
        })
      } else {
        savedTodo = await createTodo({
          title: form.title.trim(),
          notes: form.notes.trim(),
          tags: form.tags,
          dueDate: form.dueDate,
        })
      }

      if (formFiles.length > 0) {
        setUploadingId(savedTodo.id)
        for (const file of formFiles) {
          await uploadAttachment(savedTodo.id, file)
        }
      }

      resetForm()
      await refresh()
      setNotice(
        formFiles.length > 0
          ? isEditing
            ? '任务已更新，附件已上传。'
            : '任务已创建，附件已上传。'
          : isEditing
            ? '任务已更新。'
            : '任务已创建。',
      )
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
      setUploadingId(null)
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
      tagInput: '',
      tags: todo.tags,
      dueDate: todo.dueDate ?? '',
    })
    setFormFiles([])
    if (formFileInputRef.current) {
      formFileInputRef.current.value = ''
    }
    setError(null)
    setNotice('正在编辑任务。')
  }

  function handleFormFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFormFiles(Array.from(event.target.files ?? []))
  }

  function clearFormFiles() {
    setFormFiles([])
    if (formFileInputRef.current) {
      formFileInputRef.current.value = ''
    }
  }

  function addFormTag() {
    const tag = normalizeTag(form.tagInput)
    if (!tag) {
      return
    }

    setForm((current) => {
      if (current.tags.includes(tag) || current.tags.length >= 6) {
        return { ...current, tagInput: '' }
      }

      return {
        ...current,
        tagInput: '',
        tags: [...current.tags, tag],
      }
    })
  }

  function removeFormTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
    }))
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
      <div className="todo-layout">
        <section className="control-panel">
          <section className="control-card workspace-panel bg-white">
            <div className="workspace-top">
              <div className="workspace-head">
                <div className="new-task-header flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-smoke">
                      {editingTodoId ? '编辑任务' : '新建任务'}
                    </p>
                    <h1 className="new-task-title mt-1 text-xl font-bold text-ink">ToDo</h1>
                  </div>
                  {editingTodoId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-paper"
                    >
                      取消
                    </button>
                  )}
                </div>

                <div className="overview-inline" aria-label="任务总览">
                  <div className="overview-inline-title">
                    <h2 className="text-sm font-bold text-ink">任务总览</h2>
                    <span className="text-[11px] text-smoke">按日期</span>
                  </div>
                  <div className="stats-grid">
                    <StatCard label="总任务" value={data?.stats.total ?? 0} />
                    <StatCard label="待完成" value={data?.stats.open ?? 0} />
                    <StatCard label="已完成" value={data?.stats.done ?? 0} />
                    <StatCard label="有标签" value={data?.stats.tagged ?? 0} />
                  </div>
                </div>
              </div>

              <form className="new-task-form" onSubmit={handleSubmit}>
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="任务标题"
                  className="new-task-title-input w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-base outline-none transition focus:bg-white"
                />

                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="备注"
                  className="new-task-notes w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:bg-white"
                />

                <div className="new-task-meta grid gap-3 sm:grid-cols-2">
                  <div className="block">
                    <span className="mb-1 block text-xs font-medium text-smoke">标签配置</span>
                    <div className="flex gap-2">
                      <input
                        value={form.tagInput}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, tagInput: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addFormTag()
                          }
                        }}
                        placeholder="输入标签"
                        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:bg-white"
                      />
                      <button
                        type="button"
                        disabled={form.tags.length >= 6}
                        onClick={addFormTag}
                        className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        添加
                      </button>
                    </div>

                    {form.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.tags.map((tag, index) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => removeFormTag(tag)}
                            className={[
                              'rounded-md px-2 py-1 text-[11px] font-semibold transition hover:opacity-75',
                              tagTone(index),
                            ].join(' ')}
                          >
                            {tag} x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-smoke">
                      DDL 最晚日期
                    </span>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, dueDate: event.target.value }))
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:bg-white"
                    />
                  </label>
                </div>

                <div className="new-task-footer">
                  <div className="new-task-attachment rounded-lg border border-dashed border-line bg-paper p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-smoke">附件</p>
                        <p className="mt-1 truncate text-sm text-ink">
                          {formatSelectedFiles(formFiles)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-sand">
                          选择附件
                          <input
                            ref={formFileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            disabled={submitting}
                            onChange={handleFormFilesChange}
                          />
                        </label>

                        {formFiles.length > 0 && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={clearFormFiles}
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            清空
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="new-task-submit w-full rounded-lg border border-line bg-clay px-4 py-2.5 text-sm font-bold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? formFiles.length > 0
                        ? '保存并上传中...'
                        : '保存中...'
                      : editingTodoId
                        ? '保存修改'
                        : '创建任务'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </section>

        <section className="task-panel">
          <div className="flex flex-col gap-3 border-b-2 border-dashed border-line pb-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-smoke">
                {openTodos.length} 项待办
              </span>
            </div>

            {(error || notice) && (
              <div
                className={[
                  'rounded-lg border px-3 py-2 text-sm',
                  error
                    ? 'border-clay bg-[#fff4ee] text-[#8a3f1f]'
                    : 'border-moss bg-[#f2f6ee] text-[#405131]',
                ].join(' ')}
                aria-live="polite"
              >
                {error ?? notice}
              </div>
            )}
          </div>

          <div className="task-list">
            {doneTodos.length > 0 && (
              <CompletedGroupTrigger
                count={doneTodos.length}
                onOpen={() => setCompletedModalOpen(true)}
              />
            )}

            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-lg border-2 border-line bg-white/80"
                />
              ))
            ) : timeline.length > 0 ? (
              timeline.map((group) => (
                <TimelineGroup
                  key={group.key}
                  label={group.label}
                  items={group.items}
                  collapsed={collapsedDates.has(group.key)}
                  busyId={busyId}
                  uploadingId={uploadingId}
                  onToggleGroup={() => toggleDateGroup(group.key)}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onUpload={handleUpload}
                  onDeleteAttachment={handleDeleteAttachment}
                />
              ))
            ) : (
              <div className="rounded-lg border-2 border-dashed border-line bg-white px-6 py-10 text-center">
                <p className="text-sm text-smoke">当前没有待完成任务</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {completedModalOpen && (
        <CompletedTaskModal
          todos={doneTodos}
          dateValue={completedDate}
          searchValue={completedSearch}
          busyId={busyId}
          uploadingId={uploadingId}
          onDateChange={setCompletedDate}
          onSearchChange={setCompletedSearch}
          onClose={() => setCompletedModalOpen(false)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onUpload={handleUpload}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}
    </main>
  )
}
