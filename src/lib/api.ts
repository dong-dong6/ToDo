import type { CreateTodoInput, Todo, TodoAttachment, TodoResponse, UpdateTodoInput } from './types'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Request failed')
  }

  return response.json() as Promise<T>
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
