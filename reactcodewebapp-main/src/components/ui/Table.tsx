import type { ReactNode } from 'react';
import { Pretext } from './Pretext';

interface Column {
  key: string;
  label: string;
  width?: string;
  usePretext?: boolean;
}

interface TableProps {
  columns: Column[];
  children: ReactNode;
  className?: string;
}

export function Table({ columns, children, className }: TableProps) {
  return (
    <div className={`table-wrap ${className || ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                <Pretext text={c.label} font="700 9px Inter" balanced />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface TableRowProps {
  cells: ReactNode[];
  onClick?: () => void;
  className?: string;
  pretextCells?: number[]; // Indices of cells to wrap in Pretext
  font?: string;
}

export function TableRow({ cells, onClick, className, pretextCells = [], font = '400 12px Inter' }: TableRowProps) {
  return (
    <tr className={className} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {cells.map((cell, i) => (
        <td key={i}>
          {pretextCells.includes(i) && typeof cell === 'string' ? (
            <Pretext text={cell} font={font} lineHeight={16} />
          ) : (
            cell
          )}
        </td>
      ))}
    </tr>
  );
}
