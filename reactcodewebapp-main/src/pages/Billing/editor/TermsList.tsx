import { useState } from 'react';
import { GripIcon, TrashIcon, PlusIcon } from './icons';

interface Props {
  terms: string[];
  onChange: (next: string[]) => void;
}

export function TermsList({ terms, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overPos, setOverPos] = useState<'above' | 'below'>('above');

  const update = (i: number, value: string) => {
    onChange(terms.map((t, idx) => (idx === i ? value : t)));
  };
  const remove = (i: number) => onChange(terms.filter((_, idx) => idx !== i));
  const add = () => onChange([...terms, '']);

  const onDragStart = (e: React.DragEvent, i: number) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setOverIdx(i);
    setOverPos(above ? 'above' : 'below');
  };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null); setOverIdx(null); return;
    }
    const next = [...terms];
    const [moved] = next.splice(dragIdx, 1);
    let target = i;
    if (dragIdx < i) target -= 1;
    if (overPos === 'below') target += 1;
    target = Math.max(0, Math.min(next.length, target));
    next.splice(target, 0, moved);
    onChange(next);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <div>
      {terms.map((t, i) => {
        const cls = [
          'de-term-row',
          dragIdx === i ? 'dragging' : '',
          overIdx === i && dragIdx !== i && overPos === 'above' ? 'drop-above' : '',
          overIdx === i && dragIdx !== i && overPos === 'below' ? 'drop-below' : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={i}
            className={cls}
            draggable
            onDragStart={e => onDragStart(e, i)}
            onDragOver={e => onDragOver(e, i)}
            onDrop={e => onDrop(e, i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          >
            <div className="grip"><GripIcon /></div>
            <div className="idx">{String(i + 1).padStart(2, '0')}</div>
            <textarea
              value={t}
              onChange={e => update(i, e.target.value)}
              placeholder="Add a term…"
            />
            <button className="del" onClick={() => remove(i)} aria-label="Delete term">
              <TrashIcon />
            </button>
          </div>
        );
      })}
      <button className="de-btn" onClick={add} style={{ marginTop: 4 }}>
        <PlusIcon /> Add term
      </button>
    </div>
  );
}
