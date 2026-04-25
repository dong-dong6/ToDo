export type Priority = 'low' | 'medium' | 'high'
export type TodoFilter = 'all' | 'open' | 'done'

export interface TodoAttachment {
  id: string
  todoId: string
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string
  url: string
}

export interface Todo {
  id: string
  title: string
  notes: string
  priority: Priority
  completed: boolean
  dueDate: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  attachments: TodoAttachment[]
}

export interface TodoStats {
  total: number
  open: number
  done: number
  urgent: number
}

export interface TodoResponse {
  todos: Todo[]
  stats: TodoStats
}

export interface CreateTodoInput {
  title: string
  notes: string
  priority: Priority
  dueDate?: string
}

export interface UpdateTodoInput {
  title?: string
  notes?: string
  priority?: Priority
  dueDate?: string
  completed?: boolean
}
