import { Env, error, getTodoById, json, mapAttachment } from '../../../_lib'

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) => {
  const todoId = String(params.id)
  const todo = await getTodoById(env, todoId)

  if (!todo) {
    return error('Todo not found', 404)
  }

  if (todo.completed) {
    return error('Completed todos cannot add attachments', 409)
  }

  const formData = await request.formData()
  const file = formData.get('file')

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

  await env.TODO_ATTACHMENTS.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  })

  await env.TODO_DB.prepare(
    `INSERT INTO todo_attachments (id, todo_id, object_key, filename, content_type, size, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(
      attachmentId,
      todoId,
      objectKey,
      file.name,
      file.type || 'application/octet-stream',
      file.size,
      createdAt,
    )
    .run()

  return json(
    mapAttachment({
      id: attachmentId,
      todo_id: todoId,
      object_key: objectKey,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      size: file.size,
      created_at: createdAt,
    }),
    201,
  )
}
