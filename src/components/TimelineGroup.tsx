import type { ChangeEvent } from 'react'
import type { Todo, TodoAttachment } from '../lib/types'
import { TodoItem } from './TodoItem'

export function TimelineGroup(props: {
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
