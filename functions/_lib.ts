export interface Env {
  APP_NAME: string
  TODO_DB: D1Database
  TODO_ATTACHMENTS: R2Bucket
}

export interface TodoRow {
  id: string
  title: string
  notes: string
  priority: 'low' | 'medium' | 'high'
  completed: number
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface AttachmentRow {
  id: string
  todo_id: string
  object_key: string
  filename: string
  content_type: string
  size: number
  created_at: string
}

export interface TodoWithAttachmentRow extends TodoRow {
  attachment_id: string | null
  attachment_object_key: string | null
  attachment_filename: string | null
  attachment_content_type: string | null
  attachment_size: number | null
  attachment_created_at: string | null
}

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

export async function readRequestJson<T>(request: Request): Promise<T | null> {
  const text = await request.text()
  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

export async function getTodoById(env: Env, id: string) {
  return env.TODO_DB.prepare(
    `SELECT id, title, notes, priority, completed, due_date, created_at, updated_at, completed_at
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
  const counts = await env.TODO_DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN priority = 'high' AND completed = 0 THEN 1 ELSE 0 END) AS urgent
     FROM todos`,
  ).first<{ total: number; open: number | null; done: number | null; urgent: number | null }>()

  return {
    total: counts?.total ?? 0,
    open: counts?.open ?? 0,
    done: counts?.done ?? 0,
    urgent: counts?.urgent ?? 0,
  }
}
