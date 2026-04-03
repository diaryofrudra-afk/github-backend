import { useRef } from 'react';
import { useApp } from '../../context/AppContext';

interface LogbookViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileDataUrl: string | null;
  fileName?: string;
  onUpdate?: (file: File) => void;
  onRemove?: () => void;
}

export function LogbookViewer({ isOpen, onClose, fileDataUrl, fileName, onUpdate, onRemove }: LogbookViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useApp();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast('File too large (max 5 MB)', 'error');
    if (onUpdate) onUpdate(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 10, 0.95)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 600, fontFamily: 'var(--fh)' }}>
          {fileName || 'Logbook Scan'}
        </div>
        <button 
          onClick={onClose}
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        {fileDataUrl ? (
          fileDataUrl.startsWith('data:application/pdf') ? (
            <iframe src={fileDataUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={fileName || 'Document'} />
          ) : (
            <img src={fileDataUrl} alt="Logbook" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )
        ) : (
          <div style={{ color: 'var(--t4)' }}>No image uploaded</div>
        )}
      </div>

      {(onUpdate || onRemove) && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
          {onUpdate && (
            <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              Upload New
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </label>
          )}
          {onRemove && fileDataUrl && (
            <button className="btn-primary red" onClick={onRemove} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--red-s)', color: 'var(--red)', border: '1px solid var(--red-g)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
