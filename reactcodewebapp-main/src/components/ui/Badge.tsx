type BadgeVariant = 'green' | 'red' | 'yellow' | 'amber' | 'blue' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = 'default', className }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className || ''}`}>{label}</span>
  );
}
