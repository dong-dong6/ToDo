export interface Env {
  APP_NAME: string
  ASSETS: Fetcher
  TODO_DB: D1Database
  TODO_ATTACHMENTS: R2Bucket
}

type Priority = 'low' | 'medium' | 'high'

interface TodoRow {
  id: string
  title: string
  notes: string
  priority: Priority
  tags: string
  completed: number
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface AttachmentRow {
  id: string
  todo_id: string
  object_key: string
  filename: string
  content_type: string
  size: number
  created_at: string
}

interface TodoWithAttachmentRow extends TodoRow {
  attachment_id: string | null
  attachment_object_key: string | null
  attachment_filename: string | null
  attachment_content_type: string | null
  attachment_size: number | null
  attachment_created_at: string | null
}

interface CreateTodoBody {
  title?: string
  notes?: string
  priority?: Priority
  tags?: string[]
  dueDate?: string
}

interface UpdateTodoBody {
  title?: string
  notes?: string
  priority?: Priority
  tags?: string[]
  dueDate?: string
  completed?: boolean
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

const worker: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    try {
      return await handleApiRequest(request, env, url.pathname)
    } catch (exception) {
      if (exception instanceof SyntaxError) {
        return error('Invalid JSON', 400)
      }

      if (exception instanceof URIError) {
        return error('Invalid request path', 400)
      }

      console.error(exception)
      return error('Internal server error', 500)
    }
  },
}

export default worker

async function handleApiRequest(request: Request, env: Env, pathname: string) {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)

  if (segments[0] !== 'api') {
    return error('Not found', 404)
  }

  if (segments[1] === 'todos') {
    if (segments.length === 2) {
      if (request.method === 'GET') {
        return listTodos(env)
      }

      if (request.method === 'POST') {
        return createTodo(request, env)
      }

      return methodNotAllowed(['GET', 'POST'])
    }

    if (segments.length === 3) {
      const id = segments[2]

      if (request.method === 'PATCH') {
        return updateTodo(request, env, id)
      }

      if (request.method === 'DELETE') {
        return deleteTodo(env, id)
      }

      return methodNotAllowed(['PATCH', 'DELETE'])
    }

    if (segments.length === 4 && segments[3] === 'attachments') {
      if (request.method === 'POST') {
        return uploadAttachment(request, env, segments[2])
      }

      return methodNotAllowed(['POST'])
    }
  }

  if (segments[1] === 'attachments') {
    if (segments.length === 3) {
      if (request.method === 'DELETE') {
        return deleteAttachment(env, segments[2])
      }

      return methodNotAllowed(['DELETE'])
    }

    if (segments.length === 4 && segments[3] === 'file') {
      if (request.method === 'GET') {
        return getAttachmentFile(env, segments[2])
      }

      return methodNotAllowed(['GET'])
    }
  }

  return error('Not found', 404)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function error(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function methodNotAllowed(allowedMethods: string[]) {
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      Allow: allowedMethods.join(', '),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function isPriority(value: unknown): value is Priority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function sanitizeTags(value: unknown) {
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

function parseTags(value: string | null) {
  if (!value) {
    return []
  }

  try {
    return sanitizeTags(JSON.parse(value))
  } catch {
    return []
  }
}

async function ensureTodoTagsColumn(env: Env) {
  const { results } = await env.TODO_DB.prepare('PRAGMA table_info(todos)').all<{ name: string }>()
  const hasTags = results.some((column) => column.name === 'tags')

  if (!hasTags) {
    await env.TODO_DB.prepare("ALTER TABLE todos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'").run()
  }
}

function mapAttachment(row: AttachmentRow) {
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

function buildTodo(row: TodoWithAttachmentRow) {
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

async function readRequestJson<T>(request: Request): Promise<T | null> {
  const text = await request.text()
  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

async function getTodoById(env: Env, id: string) {
  await ensureTodoTagsColumn(env)

  return env.TODO_DB.prepare(
    `SELECT id, title, notes, priority, tags, completed, due_date, created_at, updated_at, completed_at
     FROM todos
     WHERE id = ?1`,
  )
    .bind(id)
    .first<TodoRow>()
}

async function getAttachmentById(env: Env, id: string) {
  return env.TODO_DB.prepare(
    `SELECT id, todo_id, object_key, filename, content_type, size, created_at
     FROM todo_attachments
     WHERE id = ?1`,
  )
    .bind(id)
    .first<AttachmentRow>()
}

async function getStats(env: Env) {
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

async function listTodos(env: Env) {
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

async function createTodo(request: Request, env: Env) {
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

async function updateTodo(request: Request, env: Env, id: string) {
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

async function deleteTodo(env: Env, id: string) {
  const existing = await getTodoById(env, id)

  if (!existing) {
    return error('Todo not found', 404)
  }

  await env.TODO_DB.prepare('DELETE FROM todos WHERE id = ?1').bind(id).run()
  return new Response(null, { status: 204 })
}

async function uploadAttachment(request: Request, env: Env, todoId: string) {
  const todo = await getTodoById(env, todoId)

  if (!todo) {
    return error('Todo not found', 404)
  }

  if (todo.completed) {
    return error('Completed todos cannot add attachments', 409)
  }

  const formData = await request.formData()
  const file = formData.get('file') as unknown

  if (!(file instanceof File)) {
    return error('File is required', 422)
  }

  if (file.size <= 0) {
    return error('File cannot be empty', 422)
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return error('File exceeds 10MB limit', 422)
  }

  const attachmentId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const objectKey = `attachments/${todoId}/${attachmentId}${extension}`
  const contentType = file.type || 'application/octet-stream'

  await env.TODO_ATTACHMENTS.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType,
    },
  })

  await env.TODO_DB.prepare(
    `INSERT INTO todo_attachments (id, todo_id, object_key, filename, content_type, size, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(attachmentId, todoId, objectKey, file.name, contentType, file.size, createdAt)
    .run()

  return json(
    mapAttachment({
      id: attachmentId,
      todo_id: todoId,
      object_key: objectKey,
      filename: file.name,
      content_type: contentType,
      size: file.size,
      created_at: createdAt,
    }),
    201,
  )
}

async function deleteAttachment(env: Env, id: string) {
  const attachment = await getAttachmentById(env, id)

  if (!attachment) {
    return error('Attachment not found', 404)
  }

  const todo = await getTodoById(env, attachment.todo_id)
  if (!todo) {
    return error('Todo not found', 404)
  }

  if (todo.completed) {
    return error('Completed todos cannot delete attachments', 409)
  }

  await env.TODO_ATTACHMENTS.delete(attachment.object_key)
  await env.TODO_DB.prepare('DELETE FROM todo_attachments WHERE id = ?1').bind(id).run()
  return new Response(null, { status: 204 })
}

async function getAttachmentFile(env: Env, id: string) {
  const attachment = await getAttachmentById(env, id)

  if (!attachment) {
    return error('Attachment not found', 404)
  }

  const object = await env.TODO_ATTACHMENTS.get(attachment.object_key)
  if (!object || !object.body) {
    return error('Attachment file not found', 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set(
    'content-disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  )

  return new Response(object.body, { headers })
}
