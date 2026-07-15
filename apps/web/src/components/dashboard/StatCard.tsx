interface StatCardProps {
  label: string
  value: number
  description: string
}

export function StatCard({
  label,
  value,
  description,
}: StatCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  )
}