import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import * as api from '../lib/api'
import {
  createOptimisticAttachment,
  createOptimisticTodo,
  todoReducer,
} from '../lib/todoReducer'
import type { TodoState } from '../lib/todoReducer'
import type { CreateTodoInput, Todo, TodoAttachment, UpdateTodoInput } from '../lib/types'

const INITIAL_STATE: TodoState = { todos: [], stats: { total: 0, open: 0, done: 0, tagged: 0 } }

export function useTodos(enabled: boolean) {
  const [state, dispatch] = useReducer(todoReducer, INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const snapshotRef = useRef<TodoState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state

  const saveSnapshot = useCallback(() => {
    const s = stateRef.current
    snapshotRef.current = { todos: [...s.todos], stats: { ...s.stats } }
  }, [])

  const revert = useCallback(() => {
    dispatch({ type: 'REVERT', payload: snapshotRef.current })
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getTodos()
      dispatch({ type: 'SET_DATA', payload: result })
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载待办失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void refresh()
  }, [refresh, enabled])

  const clearNotice = useCallback(() => setNotice(null), [])
  const clearError = useCallback(() => setError(null), [])

  const handleCreateTodo = useCallback(
    async (input: CreateTodoInput, files: File[]) => {
      setSubmitting(true)
      setError(null)
      setNotice(null)

      const optimistic = createOptimisticTodo(input)
      saveSnapshot()
      dispatch({ type: 'OPTIMISTIC_CREATE', payload: { tempId: optimistic.id, todo: optimistic } })

      try {
        const saved = await api.createTodo(input)
        dispatch({ type: 'SYNC_CREATE', payload: { tempId: optimistic.id, todo: saved } })

        if (files.length > 0) {
          setUploadingId(saved.id)
          for (const file of files) {
            const optimisticAtt = createOptimisticAttachment(file)
            optimisticAtt.todoId = saved.id
            dispatch({
              type: 'OPTIMISTIC_ADD_ATTACHMENT',
              payload: { todoId: saved.id, attachment: optimisticAtt },
            })
            try {
              const realAtt = await api.uploadAttachment(saved.id, file)
              dispatch({
                type: 'SYNC_ATTACHMENT',
                payload: { todoId: saved.id, tempId: optimisticAtt.id, attachment: realAtt },
              })
            } catch {
              // attachment upload failed, remove optimistic one
              dispatch({
                type: 'OPTIMISTIC_DELETE_ATTACHMENT',
                payload: { todoId: saved.id, attachmentId: optimisticAtt.id },
              })
              throw new Error('附件上传失败')
            }
          }
        }

        setNotice(files.length > 0 ? '任务已创建，附件已上传。' : '任务已创建。')
      } catch (e) {
        revert()
        setError(e instanceof Error ? e.message : '创建任务失败')
      } finally {
        setSubmitting(false)
        setUploadingId(null)
      }
    },
    [saveSnapshot, revert],
  )

  const handleUpdateTodo = useCallback(
    async (id: string, input: UpdateTodoInput, files: File[]) => {
      setSubmitting(true)
      setError(null)
      setNotice(null)

      saveSnapshot()
      dispatch({ type: 'OPTIMISTIC_UPDATE', payload: { id, changes: input as Partial<Todo> } })

      try {
        const saved = await api.updateTodo(id, input)
        dispatch({ type: 'SYNC_UPDATE', payload: { todo: saved } })

        if (files.length > 0) {
          setUploadingId(saved.id)
          for (const file of files) {
            const optimisticAtt = createOptimisticAttachment(file)
            optimisticAtt.todoId = saved.id
            dispatch({
              type: 'OPTIMISTIC_ADD_ATTACHMENT',
              payload: { todoId: saved.id, attachment: optimisticAtt },
            })
            try {
              const realAtt = await api.uploadAttachment(saved.id, file)
              dispatch({
                type: 'SYNC_ATTACHMENT',
                payload: { todoId: saved.id, tempId: optimisticAtt.id, attachment: realAtt },
              })
            } catch {
              dispatch({
                type: 'OPTIMISTIC_DELETE_ATTACHMENT',
                payload: { todoId: saved.id, attachmentId: optimisticAtt.id },
              })
              throw new Error('附件上传失败')
            }
          }
        }

        setNotice(files.length > 0 ? '任务已更新，附件已上传。' : '任务已更新。')
      } catch (e) {
        revert()
        setError(e instanceof Error ? e.message : '更新任务失败')
      } finally {
        setSubmitting(false)
        setUploadingId(null)
      }
    },
    [saveSnapshot, revert],
  )

  const handleToggle = useCallback(
    async (todo: Todo) => {
      setBusyId(todo.id)
      setError(null)
      setNotice(null)

      saveSnapshot()
      dispatch({ type: 'OPTIMISTIC_TOGGLE', payload: { id: todo.id } })

      try {
        const saved = await api.updateTodo(todo.id, { completed: !todo.completed })
        dispatch({ type: 'SYNC_UPDATE', payload: { todo: saved } })
        if (!todo.completed) {
          setNotice('任务已完成。')
        }
      } catch (e) {
        revert()
        setError(e instanceof Error ? e.message : '更新任务失败')
      } finally {
        setBusyId(null)
      }
    },
    [saveSnapshot, revert],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id)
      setError(null)
      setNotice(null)

      saveSnapshot()
      dispatch({ type: 'OPTIMISTIC_DELETE', payload: { id } })

      try {
        await api.deleteTodo(id)
        setNotice('任务已删除。')
      } catch (e) {
        revert()
        setError(e instanceof Error ? e.message : '删除任务失败')
      } finally {
        setBusyId(null)
      }
    },
    [saveSnapshot, revert],
  )

  const handleUpload = useCallback(
    async (todo: Todo, file: File) => {
      setUploadingId(todo.id)
      setError(null)
      setNotice(null)

      const optimisticAtt = createOptimisticAttachment(file)
      optimisticAtt.todoId = todo.id
      saveSnapshot()
      dispatch({
        type: 'OPTIMISTIC_ADD_ATTACHMENT',
        payload: { todoId: todo.id, attachment: optimisticAtt },
      })

      try {
        const realAtt = await api.uploadAttachment(todo.id, file)
        dispatch({
          type: 'SYNC_ATTACHMENT',
          payload: { todoId: todo.id, tempId: optimisticAtt.id, attachment: realAtt },
        })
        setNotice(`附件已上传：${file.name}`)
      } catch (e) {
        dispatch({
          type: 'OPTIMISTIC_DELETE_ATTACHMENT',
          payload: { todoId: todo.id, attachmentId: optimisticAtt.id },
        })
        setError(e instanceof Error ? e.message : '附件上传失败')
      } finally {
        setUploadingId(null)
      }
    },
    [saveSnapshot],
  )

  const handleDeleteAttachment = useCallback(
    async (todo: Todo, attachment: TodoAttachment) => {
      setBusyId(todo.id)
      setError(null)
      setNotice(null)

      saveSnapshot()
      dispatch({
        type: 'OPTIMISTIC_DELETE_ATTACHMENT',
        payload: { todoId: todo.id, attachmentId: attachment.id },
      })

      try {
        await api.deleteAttachment(attachment.id)
        setNotice(`附件已删除：${attachment.fileName}`)
      } catch (e) {
        revert()
        setError(e instanceof Error ? e.message : '删除附件失败')
      } finally {
        setBusyId(null)
      }
    },
    [saveSnapshot, revert],
  )

  return {
    state,
    loading,
    error,
    notice,
    busyId,
    uploadingId,
    submitting,
    refresh,
    clearNotice,
    clearError,
    createTodo: handleCreateTodo,
    updateTodo: handleUpdateTodo,
    toggleTodo: handleToggle,
    deleteTodo: handleDelete,
    uploadAttachment: handleUpload,
    deleteAttachment: handleDeleteAttachment,
  }
}
