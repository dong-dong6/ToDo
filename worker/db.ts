import type { AttachmentRow, Env, Priority, TodoRow, TodoWithAttachmentRow } from './types'

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function error(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function methodNotAllowed(allowedMethods: string[]) {
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      Allow: allowedMethods.join(', '),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function isPriority(value: unknown): value is Priority {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function sanitizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const tags = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const tag = item.trim().slice(0, 24)
    if (tag) {
      tags.add(tag)
    }
  }

  return Array.from(tags).slice(0, 6)
}

export function parseTags(value: string | null) {
  if (!value) {
    return []
  }

  try {
    return sanitizeTags(JSON.parse(value))
  } catch {
    return []
  }
}

export async function ensureTodoTagsColumn(env: Env) {
  const { results } = await env.TODO_DB.prepare('PRAGMA table_info(todos)').all<{ name: string }>()
  const hasTags = results.some((column) => column.name === 'tags')

  if (!hasTags) {
    await env.TODO_DB.prepare("ALTER TABLE todos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'").run()
  }
}

export function mapAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    todoId: row.todo_id,
    objectKey: row.object_key,
    fileName: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size,
    createdAt: row.created_at,
    url: `/api/attachments/${row.id}/file`,
  }
}

export function buildTodo(row: TodoWithAttachmentRow) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    tags: parseTags(row.tags),
    completed: Boolean(row.completed),
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    attachments: [] as ReturnType<typeof mapAttachment>[],
  }
}

export async function readRequestJson<T>(request: Request): Promise<T | null> {
  const text = await request.text()
  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

export async function getTodoById(env: Env, id: string) {
  await ensureTodoTagsColumn(env)

  return env.TODO_DB.prepare(
    `SELECT id, title, notes, priority, tags, completed, due_date, created_at, updated_at, completed_at
     FROM todos
     WHERE id = ?1`,
  )
    .bind(id)
    .first<TodoRow>()
}

export async function getAttachmentById(env: Env, id: string) {
  return env.TODO_DB.prepare(
    `SELECT id, todo_id, object_key, filename, content_type, size, created_at
     FROM todo_attachments
     WHERE id = ?1`,
  )
    .bind(id)
    .first<AttachmentRow>()
}

export async function getStats(env: Env) {
  await ensureTodoTagsColumn(env)

  const counts = await env.TODO_DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN tags != '[]' AND completed = 0 THEN 1 ELSE 0 END) AS tagged
     FROM todos`,
  ).first<{ total: number; open: number | null; done: number | null; tagged: number | null }>()

  return {
    total: counts?.total ?? 0,
    open: counts?.open ?? 0,
    done: counts?.done ?? 0,
    tagged: counts?.tagged ?? 0,
  }
}
