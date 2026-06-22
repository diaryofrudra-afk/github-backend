import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = 'w-64' }: SearchInputProps) {
  return (
    <div className={`relative flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--bg4)] px-3 transition-focus-within focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-50 ${className}`}>
      <Search size={14} className="text-[var(--t4)]" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 w-full border-none bg-transparent text-xs font-medium outline-none placeholder:text-[var(--t4)]"
      />
    </div>
  );
}
