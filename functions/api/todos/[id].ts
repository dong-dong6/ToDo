import { Env, error, getTodoById, json, readRequestJson } from '../../_lib'

interface UpdateTodoBody {
  title?: string
  notes?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  completed?: boolean
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id)
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
  if (!['low', 'medium', 'high'].includes(priority)) {
    return error('Invalid priority value', 422)
  }

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
         completed = ?5,
         due_date = ?6,
         updated_at = ?7,
         completed_at = ?8
     WHERE id = ?1`,
  )
    .bind(id, title, notes, priority, completed ? 1 : 0, dueDate, updatedAt, completedAt)
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
    completed: Boolean(todo.completed),
    dueDate: todo.due_date,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
    completedAt: todo.completed_at,
    attachments: [],
  })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id)
  const existing = await getTodoById(env, id)

  if (!existing) {
    return error('Todo not found', 404)
  }

  await env.TODO_DB.prepare('DELETE FROM todos WHERE id = ?1').bind(id).run()
  return new Response(null, { status: 204 })
}
