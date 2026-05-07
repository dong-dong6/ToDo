export interface Env {
  APP_NAME: string
  ASSETS: Fetcher
  TODO_DB: D1Database
  TODO_ATTACHMENTS: R2Bucket
}

export type Priority = 'low' | 'medium' | 'high'

export interface TodoRow {
  id: string
  title: string
  notes: string
  priority: Priority
  tags: string
  completed: number
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface AttachmentRow {
  id: string
  todo_id: string
  object_key: string
  filename: string
  content_type: string
  size: number
  created_at: string
}

export interface TodoWithAttachmentRow extends TodoRow {
  attachment_id: string | null
  attachment_object_key: string | null
  attachment_filename: string | null
  attachment_content_type: string | null
  attachment_size: number | null
  attachment_created_at: string | null
}

export interface CreateTodoBody {
  title?: string
  notes?: string
  priority?: Priority
  tags?: string[]
  dueDate?: string
}

export interface UpdateTodoBody {
  title?: string
  notes?: string
  priority?: Priority
  tags?: string[]
  dueDate?: string
  completed?: boolean
}

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
