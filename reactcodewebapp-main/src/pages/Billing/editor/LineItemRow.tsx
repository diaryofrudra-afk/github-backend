import { useState } from 'react';
import { fmtINR } from '../../../utils';
import { ChevronDownIcon, GripIcon, CopyIcon, TrashIcon } from './icons';

export interface LineRow {
  key: string;
  description: string;
  details: string;
  hsn: string;
  gstRate: number;
  qty: number;
  rate: number;
  unit: string;
  imageUrl?: string;
  discount?: number;
}

interface Props {
  index: number;
  row: LineRow;
  amount: number;
  dragging: boolean;
  dropAbove: boolean;
  dropBelow: boolean;
  onChange: (patch: Partial<LineRow>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function LineItemRow({
  row, amount, dragging, dropAbove, dropBelow,
  onChange, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: Props) {
  const [open, setOpen] = useState(false);

  const cls = [
    'de-item-row',
    dragging ? 'dragging' : '',
    dropAbove ? 'drop-above' : '',
    dropBelow ? 'drop-below' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={cls}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <div className="de-drag-handle" aria-label="Drag to reorder">
          <GripIcon />
        </div>
        <div className="de-item-main">
          <input
            className="title"
            placeholder="Item description"
            value={row.description}
            onChange={e => onChange({ description: e.target.value })}
          />
          <div className="meta">
            <span>HSN: {row.hsn || '—'}</span>
            <span>•</span>
            <span>GST: {row.gstRate}%</span>
          </div>
        </div>
        <div className="de-item-num">
          <input
            value={row.hsn}
            onChange={e => onChange({ hsn: e.target.value })}
            placeholder="HSN"
          />
        </div>
        <div className="de-item-num">
          <input
            type="number"
            min={0}
            value={row.qty}
            onChange={e => onChange({ qty: Number(e.target.value) || 0 })}
          />
          <div className="step">
            <button type="button" onClick={() => onChange({ qty: row.qty + 1 })}>▲</button>
            <button type="button" onClick={() => onChange({ qty: Math.max(0, row.qty - 1) })}>▼</button>
          </div>
        </div>
        <div className="de-item-num">
          <input
            type="number"
            min={0}
            value={row.rate}
            onChange={e => onChange({ rate: Number(e.target.value) || 0 })}
          />
          <div className="step">
            <button type="button" onClick={() => onChange({ rate: row.rate + 100 })}>▲</button>
            <button type="button" onClick={() => onChange({ rate: Math.max(0, row.rate - 100) })}>▼</button>
          </div>
        </div>
        <div className="de-item-amount">{fmtINR(amount)}</div>
        <div
          className={`de-expand-handle${open ? ' open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse details' : 'Expand details'}
        >
          <ChevronDownIcon />
        </div>
      </div>
      <div className={`de-item-expand${open ? ' open' : ''}`}>
        <div className="de-item-expand-grid">
          <div className="full">
            <label className="de-label">Details</label>
            <textarea
              className="de-textarea"
              rows={2}
              placeholder="Optional sub-line description shown beneath the item"
              value={row.details}
              onChange={e => onChange({ details: e.target.value })}
            />
          </div>
          <div>
            <label className="de-label">GST rate (%)</label>
            <input
              className="de-input"
              type="number"
              value={row.gstRate}
              onChange={e => onChange({ gstRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="de-label">Unit</label>
            <input
              className="de-input"
              placeholder="hours / day / nos"
              value={row.unit}
              onChange={e => onChange({ unit: e.target.value })}
            />
          </div>
          <div>
            <label className="de-label">Discount (%)</label>
            <input
              className="de-input"
              type="number"
              value={row.discount ?? 0}
              onChange={e => onChange({ discount: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="de-item-expand-actions">
          <button className="de-btn" onClick={onDuplicate}><CopyIcon /> Duplicate</button>
          <button className="de-btn" onClick={onDelete} style={{ color: '#c43a3a' }}><TrashIcon /> Delete</button>
        </div>
      </div>
    </>
  );
}
