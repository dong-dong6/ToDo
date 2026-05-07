import type { CreateTodoInput, Todo, TodoAttachment, TodoResponse, UpdateTodoInput } from './types'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Request failed')
  }

  return response.json() as Promise<T>
}

export async function getAuthStatus(token: string | null): Promise<{ hasPassword: boolean; authenticated: boolean }> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch('/api/auth/status', { headers })
  return parseJson(response)
}

export async function authVerify(password: string): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return parseJson(response)
}

export async function authSetPassword(password: string): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch('/api/auth/set-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return parseJson(response)
}

export async function authChangePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  })
  return parseJson(response)
}

export async function authRemovePassword(password: string): Promise<{ success: boolean }> {
  const response = await fetch('/api/auth/remove-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return parseJson(response)
}

export async function getTodos(): Promise<TodoResponse> {
  const response = await fetch('/api/todos')
  return parseJson<TodoResponse>(response)
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const response = await fetch('/api/todos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return parseJson<Todo>(response)
}

export async function updateTodo(id: string, input: UpdateTodoInput): Promise<Todo> {
  const response = await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return parseJson<Todo>(response)
}

export async function deleteTodo(id: string): Promise<void> {
  const response = await fetch(`/api/todos/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Delete failed')
  }
}

export async function uploadAttachment(todoId: string, file: File): Promise<TodoAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`/api/todos/${todoId}/attachments`, {
    method: 'POST',
    body: formData,
  })

  return parseJson(response)
}

export async function deleteAttachment(id: string): Promise<void> {
  const response = await fetch(`/api/attachments/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Delete attachment failed')
  }
}
