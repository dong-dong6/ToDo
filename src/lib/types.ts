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
  tags: string[]
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
  tagged: number
}

export interface TodoResponse {
  todos: Todo[]
  stats: TodoStats
}

export interface CreateTodoInput {
  title: string
  notes: string
  tags: string[]
  dueDate?: string
}

export interface UpdateTodoInput {
  title?: string
  notes?: string
  tags?: string[]
  dueDate?: string
  completed?: boolean
}
