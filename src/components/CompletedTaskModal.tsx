import type { ChangeEvent } from 'react'
import type { Todo, TodoAttachment } from '../lib/types'
import { formatTaskDateLabel, toLocalDateKey } from '../lib/utils'
import { TodoItem } from './TodoItem'

export function CompletedTaskModal(props: {
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
