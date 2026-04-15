interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search…', id }: SearchBarProps) {
  return (
    <div className="search-box">
      <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
