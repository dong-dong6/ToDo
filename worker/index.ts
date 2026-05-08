import { deleteAttachment, getAttachmentFile, uploadAttachment } from './attachments'
import { changePassword, getAuthStatus, removePassword, requireAuth, setPassword, verify } from './auth'
import { error, methodNotAllowed } from './db'
import { createTodo, deleteTodo, listTodos, updateTodo } from './todos'
import type { Env } from './types'

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

  if (segments[1] === 'auth') {
    if (segments.length === 3) {
      if (segments[2] === 'status' && request.method === 'GET') {
        return getAuthStatus(env, request)
      }

      if (segments[2] === 'verify' && request.method === 'POST') {
        return verify(request, env)
      }

      if (segments[2] === 'set-password' && request.method === 'POST') {
        return setPassword(request, env)
      }

      if (segments[2] === 'change-password' && request.method === 'POST') {
        return changePassword(request, env)
      }

      if (segments[2] === 'remove-password' && request.method === 'POST') {
        return removePassword(request, env)
      }

      return methodNotAllowed(['GET', 'POST'])
    }
  }

  // Auth gate for all data endpoints
  if (segments[1] === 'todos' || segments[1] === 'attachments') {
    const authResponse = await requireAuth(env, request)
    if (authResponse) return authResponse
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
