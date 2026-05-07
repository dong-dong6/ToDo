import type { Todo, TodoAttachment } from '../lib/types'
import { formatBytes, formatDateTime } from '../lib/utils'

export function AttachmentList(props: {
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
