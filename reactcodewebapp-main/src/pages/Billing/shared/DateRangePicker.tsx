import { useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Popover } from './Popover';

/** ISO yyyy-MM-dd <-> Date helpers (local time, no timezone drift). */
function toISO(d: Date | undefined): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromISO(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function fmtLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fromD = fromISO(from);
  const toD = fromISO(to);
  const range: DateRange | undefined = fromD || toD ? { from: fromD, to: toD } : undefined;
  const hasRange = !!(fromD || toD);

  const handleSelect = (r: DateRange | undefined) => {
    onChange(toISO(r?.from), toISO(r?.to));
  };

  let label = 'All dates';
  if (fromD && toD) label = `${fmtLabel(fromD)} – ${fmtLabel(toD)}`;
  else if (fromD) label = `${fmtLabel(fromD)} – …`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`bl-daterange-btn ${hasRange ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Filter by date range"
      >
        <CalendarIcon />
        <span>{label}</span>
      </button>
      <Popover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} className="bl-daterange-pop">
        <DayPicker
          mode="range"
          numberOfMonths={1}
          selected={range}
          onSelect={handleSelect}
          defaultMonth={fromD ?? new Date()}
        />
        <div className="bl-daterange-foot">
          <button type="button" className="bl-clear-btn" onClick={() => onChange('', '')}>
            Clear
          </button>
          <button type="button" className="bl-daterange-done" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </Popover>
    </>
  );
}
