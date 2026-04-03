import { useApp } from '../../context/AppContext';

const ICONS: Record<string, string> = {
  success: '<circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>',
  error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/>',
};
const COLORS: Record<string, string> = {
  success: 'var(--green)', error: 'var(--red)',
  info: 'var(--accent)', warn: 'var(--amber)',
};

export function ToastContainer() {
  const { toasts } = useApp();
  return (
    <div id="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type} show`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={COLORS[t.type]} strokeWidth="2.5" strokeLinecap="round"
            dangerouslySetInnerHTML={{ __html: ICONS[t.type] }} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
