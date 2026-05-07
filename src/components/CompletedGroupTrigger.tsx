export function CompletedGroupTrigger(props: { count: number; onOpen: () => void }) {
  return (
    <section className="rounded-lg border border-line bg-[#fffaf4] shadow-soft">
      <button
        type="button"
        onClick={props.onOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/50"
      >
        <div>
          <p className="text-[11px] font-medium text-smoke">任务状态</p>
          <h3 className="mt-1 text-base font-bold leading-5 text-ink">已完成</h3>
        </div>
        <span className="shrink-0 rounded-md border border-line bg-white px-3 py-1.5 text-xs text-smoke">
          查看 · {props.count} 项
        </span>
      </button>
    </section>
  )
}
