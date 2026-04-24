import { Env, error, getAttachmentById } from '../../../_lib'

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id)
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
