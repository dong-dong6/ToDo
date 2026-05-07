import {
  buildTodo,
  ensureTodoTagsColumn,
  error,
  getStats,
  getTodoById,
  isPriority,
  json,
  mapAttachment,
  parseTags,
  readRequestJson,
  sanitizeTags,
} from './db'
import type { CreateTodoBody, Env, TodoWithAttachmentRow, UpdateTodoBody } from './types'

export async function listTodos(env: Env) {
  await ensureTodoTagsColumn(env)

  const { results } = await env.TODO_DB.prepare(
    `SELECT
        t.id,
        t.title,
        t.notes,
        t.priority,
        t.tags,
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
        }),
      )
    }
  }

  const stats = await getStats(env)

  return json({
    todos: Array.from(todoMap.values()),
    stats,
  })
}

export async function createTodo(request: Request, env: Env) {
  await ensureTodoTagsColumn(env)

  const body = await readRequestJson<CreateTodoBody>(request)
  const title = body?.title?.trim()

  if (!title) {
    return error('Title is required', 422)
  }

  const priority = body?.priority ?? 'medium'
  if (!isPriority(priority)) {
    return error('Invalid priority value', 422)
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const dueDate = body?.dueDate?.trim() ? body.dueDate : null
  const notes = body?.notes?.trim() ?? ''
  const tags = sanitizeTags(body?.tags)
  const tagsJson = JSON.stringify(tags)

  await env.TODO_DB.prepare(
    `INSERT INTO todos (id, title, notes, priority, tags, completed, due_date, created_at, updated_at, completed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?7, NULL)`,
  )
    .bind(id, title, notes, priority, tagsJson, dueDate, now)
    .run()

  return json(
    {
      id,
      title,
      notes,
      priority,
      tags,
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

export async function updateTodo(request: Request, env: Env, id: string) {
  const existing = await getTodoById(env, id)

  if (!existing) {
    return error('Todo not found', 404)
  }

  const body = await readRequestJson<UpdateTodoBody>(request)
  if (!body) {
    return error('Request body is required', 422)
  }

  if (
    existing.completed &&
    (body.title !== undefined ||
      body.notes !== undefined ||
      body.priority !== undefined ||
      body.tags !== undefined ||
      body.dueDate !== undefined) &&
    body.completed !== false
  ) {
    return error('Completed todos cannot be edited', 409)
  }

  const title = body.title === undefined ? existing.title : body.title.trim()
  if (!title) {
    return error('Title is required', 422)
  }

  const priority = body.priority ?? existing.priority
  if (!isPriority(priority)) {
    return error('Invalid priority value', 422)
  }

  const tags = body.tags === undefined ? parseTags(existing.tags) : sanitizeTags(body.tags)
  const tagsJson = JSON.stringify(tags)
  const dueDate =
    body.dueDate === undefined ? existing.due_date : body.dueDate.trim() ? body.dueDate : null
  const completed = body.completed === undefined ? Boolean(existing.completed) : body.completed
  const completedAt = completed ? existing.completed_at ?? new Date().toISOString() : null
  const updatedAt = new Date().toISOString()
  const notes = body.notes === undefined ? existing.notes : body.notes.trim()

  await env.TODO_DB.prepare(
    `UPDATE todos
     SET title = ?2,
         notes = ?3,
         priority = ?4,
         tags = ?5,
         completed = ?6,
         due_date = ?7,
         updated_at = ?8,
         completed_at = ?9
     WHERE id = ?1`,
  )
    .bind(id, title, notes, priority, tagsJson, completed ? 1 : 0, dueDate, updatedAt, completedAt)
    .run()

  const todo = await getTodoById(env, id)
  if (!todo) {
    return error('Todo not found after update', 500)
  }

  return json({
    id: todo.id,
    title: todo.title,
    notes: todo.notes,
    priority: todo.priority,
    tags: parseTags(todo.tags),
    completed: Boolean(todo.completed),
    dueDate: todo.due_date,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
    completedAt: todo.completed_at,
    attachments: [],
  })
}

export async function deleteTodo(env: Env, id: string) {
  const existing = await getTodoById(env, id)

  if (!existing) {
    return error('Todo not found', 404)
  }

  await env.TODO_DB.prepare('DELETE FROM todos WHERE id = ?1').bind(id).run()
  return new Response(null, { status: 204 })
}
