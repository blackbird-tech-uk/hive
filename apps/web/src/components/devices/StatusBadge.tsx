interface StatusBadgeProps {
  status: string
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge status-${status}`}>
      {formatLabel(status)}
    </span>
  )
}