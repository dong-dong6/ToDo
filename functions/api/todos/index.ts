import {
  Env,
  error,
  getStats,
  json,
  mapAttachment,
  readRequestJson,
  type AttachmentRow,
  type TodoWithAttachmentRow,
} from '../../_lib'

interface CreateTodoBody {
  title?: string
  notes?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
}

function buildTodo(row: TodoWithAttachmentRow) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    completed: Boolean(row.completed),
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    attachments: [] as ReturnType<typeof mapAttachment>[],
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.TODO_DB.prepare(
    `SELECT
        t.id,
        t.title,
        t.notes,
        t.priority,
        t.completed,
        t.due_date,
        t.created_at,
        t.updated_at,
        t.completed_at,
        a.id AS attachment_id,
        a.object_key AS attachment_object_key,
        a.filename AS attachment_filename,
        a.content_type AS attachment_content_type,
        a.size AS attachment_size,
        a.created_at AS attachment_created_at
     FROM todos t
     LEFT JOIN todo_attachments a ON a.todo_id = t.id
     ORDER BY t.completed ASC, t.created_at DESC, a.created_at DESC`,
  ).all<TodoWithAttachmentRow>()

  const todoMap = new Map<string, ReturnType<typeof buildTodo>>()

  for (const row of results) {
    const todo = todoMap.get(row.id) ?? buildTodo(row)
    if (!todoMap.has(row.id)) {
      todoMap.set(row.id, todo)
    }

    if (row.attachment_id) {
      todo.attachments.push(
        mapAttachment({
          id: row.attachment_id,
          todo_id: row.id,
          object_key: row.attachment_object_key!,
          filename: row.attachment_filename!,
          content_type: row.attachment_content_type!,
          size: row.attachment_size!,
          created_at: row.attachment_created_at!,
        } satisfies AttachmentRow),
      )
    }
  }

  const stats = await getStats(env)

  return json({
    todos: Array.from(todoMap.values()),
    stats,
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await readRequestJson<CreateTodoBody>(request)
  const title = body?.title?.trim()

  if (!title) {
    return error('Title is required', 422)
  }

  const priority = body?.priority ?? 'medium'
  if (!['low', 'medium', 'high'].includes(priority)) {
    return error('Invalid priority value', 422)
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const dueDate = body?.dueDate?.trim() ? body.dueDate : null
  const notes = body?.notes?.trim() ?? ''

  await env.TODO_DB.prepare(
    `INSERT INTO todos (id, title, notes, priority, completed, due_date, created_at, updated_at, completed_at)
     VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6, NULL)`,
  )
    .bind(id, title, notes, priority, dueDate, now)
    .run()

  return json(
    {
      id,
      title,
      notes,
      priority,
      completed: false,
      dueDate,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      attachments: [],
    },
    201,
  )
}
