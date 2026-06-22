import { useState } from 'react';

export interface Column {
  key: string;
  header: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (row: any) => React.ReactNode;
  sortKey?: string;
  align?: 'left' | 'right';
  mobileHide?: boolean;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  columns: Column[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowClick?: (row: any) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 12;

export function DocumentListView({
  rows,
  columns,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  emptyTitle = 'No records found',
  emptySubtitle = 'Create your first record to get started.',
  emptyAction,
  pageSize = PAGE_SIZE_DEFAULT,
}: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const SortArrow = ({ colKey }: { colKey: string }) => {
    if (sortBy !== colKey) return <span className="bl-sort-arrow">↕</span>;
    return <span className="bl-sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (rows.length === 0) {
    return (
      <div className="bl-empty">
        <div className="bl-empty-icon">📄</div>
        <div className="bl-empty-title">{emptyTitle}</div>
        <div className="bl-empty-sub">{emptySubtitle}</div>
        {emptyAction}
      </div>
    );
  }

  return (
    <>
      <div className="bl-table-wrap">
        <table className="bl-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={[
                    col.sortKey ? 'bl-sortable' : '',
                    col.sortKey && sortBy === col.sortKey ? 'bl-sort-active' : '',
                    col.mobileHide ? 'bl-mobile-hide' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ textAlign: col.align || 'left' }}
                  onClick={() => col.sortKey && onSort(col.sortKey)}
                >
                  {col.header}
                  {col.sortKey && <SortArrow colKey={col.sortKey} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={col.mobileHide ? 'bl-mobile-hide' : ''}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize && (
        <div className="bl-pagination">
          <span className="bl-page-info">
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
          </span>
          <div className="bl-page-btns">
            <button
              className="bl-page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              ←
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  className={`bl-page-btn ${safePage === pageNum ? 'bl-page-active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="bl-page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
