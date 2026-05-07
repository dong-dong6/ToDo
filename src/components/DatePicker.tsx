import { useEffect, useMemo, useState } from 'react'
import { buildCalendarDays, dateFromKey, formatDeadlineLabel, formatMonthLabel, toLocalDateKey } from '../lib/utils'

export function DatePicker(props: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() =>
    props.value ? dateFromKey(props.value) : new Date(),
  )
  const todayKey = toLocalDateKey(new Date())
  const selectedLabel = props.value ? formatDeadlineLabel(props.value) : '选择日期'
  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])

  useEffect(() => {
    if (props.value) {
      setViewMonth(dateFromKey(props.value))
    }
  }, [props.value])

  function shiftMonth(offset: number) {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <div
      className="date-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
        className={[
          'date-picker-trigger w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-left text-sm outline-none transition hover:bg-white focus:bg-white disabled:cursor-not-allowed disabled:opacity-60',
          props.value ? 'text-ink' : 'text-smoke',
        ].join(' ')}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="date-picker-panel" role="dialog" aria-label="选择 DDL 日期">
          <div className="date-picker-head">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月">
              ‹
            </button>
            <strong>{formatMonthLabel(viewMonth)}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月">
              ›
            </button>
          </div>

          <div className="date-picker-weekdays" aria-hidden="true">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {days.map((item) => {
              const selected = item.key === props.value
              const today = item.key === todayKey

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    props.onChange(item.key)
                    setOpen(false)
                  }}
                  className={[
                    'date-picker-day',
                    item.inMonth ? 'text-ink' : 'text-smoke',
                    today ? 'date-picker-day-today' : '',
                    selected ? 'date-picker-day-selected' : '',
                  ].join(' ')}
                >
                  {item.date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="date-picker-actions">
            <button
              type="button"
              onClick={() => {
                props.onChange(todayKey)
                setOpen(false)
              }}
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => {
                props.onChange('')
                setOpen(false)
              }}
            >
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
