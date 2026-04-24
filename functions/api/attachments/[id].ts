import { Env, error, getAttachmentById, getTodoById } from '../../_lib'

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id)
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
