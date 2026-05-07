import type { Todo, TodoAttachment, TodoStats } from './types'

export interface TodoState {
  todos: Todo[]
  stats: TodoStats
}

export type TodoAction =
  | { type: 'SET_DATA'; payload: TodoState }
  | { type: 'OPTIMISTIC_CREATE'; payload: { tempId: string; todo: Todo } }
  | { type: 'OPTIMISTIC_UPDATE'; payload: { id: string; changes: Partial<Todo> } }
  | { type: 'OPTIMISTIC_DELETE'; payload: { id: string } }
  | { type: 'OPTIMISTIC_TOGGLE'; payload: { id: string } }
  | { type: 'OPTIMISTIC_ADD_ATTACHMENT'; payload: { todoId: string; attachment: TodoAttachment } }
  | { type: 'OPTIMISTIC_DELETE_ATTACHMENT'; payload: { todoId: string; attachmentId: string } }
  | { type: 'SYNC_CREATE'; payload: { tempId: string; todo: Todo } }
  | { type: 'SYNC_UPDATE'; payload: { todo: Todo } }
  | { type: 'SYNC_ATTACHMENT'; payload: { todoId: string; tempId: string; attachment: TodoAttachment } }
  | { type: 'REVERT'; payload: TodoState }

const EMPTY_STATS: TodoStats = { total: 0, open: 0, done: 0, tagged: 0 }

export function computeStats(todos: Todo[]): TodoStats {
  if (todos.length === 0) {
    return EMPTY_STATS
  }

  let open = 0
  let done = 0
  let tagged = 0

  for (const todo of todos) {
    if (todo.completed) {
      done++
    } else {
      open++
    }
    if (todo.tags.length > 0) {
      tagged++
    }
  }

  return { total: todos.length, open, done, tagged }
}

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'SET_DATA':
      return action.payload

    case 'OPTIMISTIC_CREATE': {
      const todos = [action.payload.todo, ...state.todos]
      return { todos, stats: computeStats(todos) }
    }

    case 'OPTIMISTIC_UPDATE': {
      const todos = state.todos.map((t) =>
        t.id === action.payload.id ? { ...t, ...action.payload.changes } : t,
      )
      return { todos, stats: computeStats(todos) }
    }

    case 'OPTIMISTIC_TOGGLE': {
      const todos = state.todos.map((t) => {
        if (t.id !== action.payload.id) return t
        const now = new Date().toISOString()
        return {
          ...t,
          completed: !t.completed,
          completedAt: t.completed ? null : now,
          updatedAt: now,
        }
      })
      return { todos, stats: computeStats(todos) }
    }

    case 'OPTIMISTIC_DELETE': {
      const todos = state.todos.filter((t) => t.id !== action.payload.id)
      return { todos, stats: computeStats(todos) }
    }

    case 'OPTIMISTIC_ADD_ATTACHMENT': {
      const todos = state.todos.map((t) =>
        t.id === action.payload.todoId
          ? { ...t, attachments: [...t.attachments, action.payload.attachment] }
          : t,
      )
      return { todos, stats: computeStats(todos) }
    }

    case 'OPTIMISTIC_DELETE_ATTACHMENT': {
      const todos = state.todos.map((t) =>
        t.id === action.payload.todoId
          ? { ...t, attachments: t.attachments.filter((a) => a.id !== action.payload.attachmentId) }
          : t,
      )
      return { todos, stats: computeStats(todos) }
    }

    case 'SYNC_CREATE': {
      const todos = state.todos.map((t) => (t.id === action.payload.tempId ? action.payload.todo : t))
      return { todos, stats: computeStats(todos) }
    }

    case 'SYNC_UPDATE': {
      const todos = state.todos.map((t) =>
        t.id === action.payload.todo.id ? action.payload.todo : t,
      )
      return { todos, stats: computeStats(todos) }
    }

    case 'SYNC_ATTACHMENT': {
      const todos = state.todos.map((t) =>
        t.id === action.payload.todoId
          ? {
              ...t,
              attachments: t.attachments.map((a) =>
                a.id === action.payload.tempId ? action.payload.attachment : a,
              ),
            }
          : t,
      )
      return { todos, stats: computeStats(todos) }
    }

    case 'REVERT':
      return action.payload

    default:
      return state
  }
}

export function createOptimisticTodo(input: {
  title: string
  notes: string
  tags: string[]
  dueDate?: string
}): Todo {
  const now = new Date().toISOString()
  return {
    id: `temp-${crypto.randomUUID()}`,
    title: input.title,
    notes: input.notes,
    tags: input.tags,
    completed: false,
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    attachments: [],
  }
}

export function createOptimisticAttachment(file: File): TodoAttachment {
  return {
    id: `temp-${crypto.randomUUID()}`,
    todoId: '',
    objectKey: '',
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
    url: '',
  }
}
