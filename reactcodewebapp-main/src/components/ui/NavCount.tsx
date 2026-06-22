interface NavCountProps {
  count: number;
  id?: string;
  variant?: 'default' | 'alert';
}

export function NavCount({ count, id, variant = 'default' }: NavCountProps) {
  if (count === 0) return null;
  return (
    <span className={`nav-count ${variant === 'alert' ? 'alert' : ''}`} id={id}>
      {count}
    </span>
  );
}
