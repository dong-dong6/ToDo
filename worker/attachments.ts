import { error, getAttachmentById, getTodoById, json, mapAttachment } from './db'
import type { Env } from './types'

export async function uploadAttachment(request: Request, env: Env, todoId: string) {
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

  if (file.size > (10 * 1024 * 1024)) {
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

export async function deleteAttachment(env: Env, id: string) {
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

export async function getAttachmentFile(env: Env, id: string) {
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
