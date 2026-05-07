export function StatCard(props: { label: string; value: number }) {
  return (
    <div className="stat-item">
      <p className="text-[11px] font-medium text-smoke">{props.label}</p>
      <p className="mt-1 text-xl font-bold leading-none text-ink">{props.value}</p>
    </div>
  )
}
