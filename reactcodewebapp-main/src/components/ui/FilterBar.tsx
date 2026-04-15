interface FilterPill {
  value: string;
  label: string;
}

interface FilterBarProps {
  pills: FilterPill[];
  active: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}

export function FilterBar({ pills, active, onChange, id, className }: FilterBarProps) {
  return (
    <div className={`filter-row ${className || ''}`} id={id}>
      {pills.map(p => (
        <span
          key={p.value}
          className={`fpill ${active === p.value ? 'active' : ''}`}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}
