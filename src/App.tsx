import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react'
import { useLock } from './hooks/useLock'
import { useTodos } from './hooks/useTodos'
import { CompletedGroupTrigger } from './components/CompletedGroupTrigger'
import { CompletedTaskModal } from './components/CompletedTaskModal'
import { DatePicker } from './components/DatePicker'
import { LockScreen } from './components/LockScreen'
import { SecuritySettings } from './components/SecuritySettings'
import { StatCard } from './components/StatCard'
import { TimelineGroup } from './components/TimelineGroup'
import type { Todo } from './lib/types'
import {
  buildTimeline,
  formatSelectedFiles,
  normalizeTag,
  tagTone,
} from './lib/utils'

const initialForm = {
  title: '',
  notes: '',
  tagInput: '',
  tags: [] as string[],
  dueDate: '',
}

export default function App() {
  const {
    state,
    loading,
    error,
    notice,
    busyId,
    uploadingId,
    submitting,
    clearError,
    clearNotice,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    uploadAttachment,
    deleteAttachment,
  } = useTodos()

  const lock = useLock()

  const [form, setForm] = useState(initialForm)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [formFiles, setFormFiles] = useState<File[]>([])
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [completedModalOpen, setCompletedModalOpen] = useState(false)
  const [completedDate, setCompletedDate] = useState('')
  const [completedSearch, setCompletedSearch] = useState('')
  const formFileInputRef = useRef<HTMLInputElement>(null)

  const openTodos = useMemo(() => state.todos.filter((t) => !t.completed), [state.todos])
  const doneTodos = useMemo(
    () =>
      state.todos
        .filter((t) => t.completed)
        .sort((a, b) => {
          const left = a.completedAt ?? a.updatedAt
          const right = b.completedAt ?? b.updatedAt
          return right.localeCompare(left)
        }),
    [state.todos],
  )
  const timeline = useMemo(() => buildTimeline(openTodos), [openTodos])

  function resetForm() {
    setForm(initialForm)
    setFormFiles([])
    setEditingTodoId(null)
    if (formFileInputRef.current) {
      formFileInputRef.current.value = ''
    }
  }

  function handleEdit(todo: Todo) {
    if (todo.completed) return
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
    clearError()
    clearNotice()
  }

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
      return
    }

    const input = {
      title: form.title.trim(),
      notes: form.notes.trim(),
      tags: form.tags,
      dueDate: form.dueDate,
    }

    if (editingTodoId) {
      await updateTodo(editingTodoId, input, formFiles)
    } else {
      await createTodo(input, formFiles)
    }

    resetForm()
  }

  function addFormTag() {
    const tag = normalizeTag(form.tagInput)
    if (!tag) return

    setForm((current) => {
      if (current.tags.includes(tag) || current.tags.length >= 6) {
        return { ...current, tagInput: '' }
      }
      return { ...current, tagInput: '', tags: [...current.tags, tag] }
    })
  }

  function removeFormTag(tag: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
    }))
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

  async function handleUpload(todo: Todo, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await uploadAttachment(todo, file)
  }

  async function handleToggle(todo: Todo) {
    await toggleTodo(todo)
    if (!todo.completed && editingTodoId === todo.id) {
      resetForm()
    }
  }

  async function handleDelete(id: string) {
    await deleteTodo(id)
    if (editingTodoId === id) {
      resetForm()
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      {lock.locked && (
        <LockScreen
          hasPassword={lock.hasPassword}
          onUnlock={lock.unlock}
          onSetPassword={lock.setPassword}
        />
      )}

      {lock.showSettings && (
        <SecuritySettings
          hasPassword={lock.hasPassword}
          timeoutMs={lock.timeoutMs}
          timeoutOptions={lock.TIMEOUT_OPTIONS}
          onClose={() => lock.setShowSettings(false)}
          onChangePassword={lock.changePassword}
          onRemovePassword={lock.removePassword}
          onSetTimeout={lock.setTimeout}
        />
      )}

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
                  <div className="flex items-center gap-2">
                    {editingTodoId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-paper"
                      >
                        取消
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => lock.setShowSettings(true)}
                      title="安全设置"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-smoke transition hover:bg-paper hover:text-ink"
                    >
                      &#9881;
                    </button>
                  </div>
                </div>

                <div className="overview-inline" aria-label="任务总览">
                  <div className="overview-inline-title">
                    <h2 className="text-sm font-bold text-ink">任务总览</h2>
                    <span className="text-[11px] text-smoke">按日期</span>
                  </div>
                  <div className="stats-grid">
                    <StatCard label="总任务" value={state.stats.total} />
                    <StatCard label="待完成" value={state.stats.open} />
                    <StatCard label="已完成" value={state.stats.done} />
                    <StatCard label="有标签" value={state.stats.tagged} />
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
                    <div className="tag-input-shell rounded-lg border border-line bg-paper px-2 py-1.5 transition focus-within:bg-white">
                      {form.tags.map((tag, index) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => removeFormTag(tag)}
                          className={[
                            'tag-input-chip rounded-md px-2 py-1 text-[11px] font-semibold transition hover:opacity-75',
                            tagTone(index),
                          ].join(' ')}
                        >
                          <span>{tag}</span>
                          <span aria-hidden="true">x</span>
                        </button>
                      ))}
                      <input
                        value={form.tagInput}
                        disabled={form.tags.length >= 6}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, tagInput: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            event.preventDefault()
                            addFormTag()
                          }
                        }}
                        placeholder={form.tags.length >= 6 ? '标签已满' : '输入标签后按回车'}
                        className="tag-input-field min-w-[9rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-smoke">
                      DDL 最晚日期
                    </span>
                    <DatePicker
                      value={form.dueDate}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, dueDate: value }))
                      }
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
                  onDeleteAttachment={deleteAttachment}
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
          onDeleteAttachment={deleteAttachment}
        />
      )}
    </main>
  )
}
