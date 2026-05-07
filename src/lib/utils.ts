import type { Todo } from './types'

export const tagTones = [
  'bg-sand text-ink',
  'bg-[#edf2e6] text-[#405131]',
  'bg-[#fff4ee] text-[#8a3f1f]',
  'bg-white/80 text-ink',
]

export function tagTone(index: number) {
  return tagTones[index % tagTones.length]
}

export function toLocalDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatTaskDateLabel(value: string) {
  const today = toLocalDateKey(new Date())
  const dateText = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateFromKey(value))

  if (value === today) {
    return `今天 · ${dateText}`
  }

  return dateText
}

export function formatDeadlineLabel(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateFromKey(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(value)
}

export function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatSelectedFiles(files: File[]) {
  if (files.length === 0) {
    return '未选择附件'
  }

  if (files.length === 1) {
    return files[0].name
  }

  return `${files.length} 个附件`
}

export function normalizeTag(value: string) {
  return value.trim().slice(0, 24)
}

export function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const startDate = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)

    return {
      key: toLocalDateKey(date),
      date,
      inMonth: date.getMonth() === month,
    }
  })
}

export function buildTimeline(todos: Todo[]) {
  const groups = new Map<string, Todo[]>()

  for (const todo of todos) {
    const key = toLocalDateKey(todo.createdAt)
    const list = groups.get(key) ?? []
    list.push(todo)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => ({
      key,
      label: formatTaskDateLabel(key),
      items: items.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }))
}
