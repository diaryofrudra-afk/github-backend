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
    <div className="logbook-viewer-overlay">
      <div className="logbook-viewer-header">
        <div className="logbook-viewer-title">
          {fileName || 'Logbook Scan'}
        </div>
        <button className="logbook-viewer-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="logbook-viewer-image-container">
        {fileDataUrl ? (
          fileDataUrl.startsWith('data:application/pdf') ? (
            <iframe src={fileDataUrl} className="logbook-viewer-iframe" title={fileName || 'Document'} />
          ) : (
            <img src={fileDataUrl} alt="Logbook" className="logbook-viewer-img" />
          )
        ) : (
          <div className="logbook-viewer-empty">No image uploaded</div>
        )}
      </div>

      {(onUpdate || onRemove) && (
        <div className="logbook-viewer-actions">
          {onUpdate && (
            <label className="btn-primary logbook-viewer-upload" style={{ cursor: 'pointer' }}>
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
            <button className="btn-primary red logbook-viewer-remove" style={{ background: 'var(--red-s)', color: 'var(--red)', border: '1px solid var(--red-g)' }}>
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
