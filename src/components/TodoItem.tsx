import type { ChangeEvent } from 'react'
import type { Todo, TodoAttachment } from '../lib/types'
import { formatDateTime, formatDeadlineLabel, tagTone } from '../lib/utils'
import { AttachmentList } from './AttachmentList'

export function TodoItem(props: {
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
