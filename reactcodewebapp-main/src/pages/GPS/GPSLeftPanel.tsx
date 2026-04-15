interface GPSLeftPanelProps {
  connectedCount: number;
  totalCount: number;
  engineOnCount?: number;
  onLayersClick: () => void;
  onLocationClick: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSettings: () => void;
}

export function GPSLeftPanel({
  connectedCount,
  totalCount,
  engineOnCount,
  onLayersClick,
  onLocationClick,
  onZoomIn,
  onZoomOut,
  onSettings,
}: GPSLeftPanelProps) {
  return (
    <div className="beacon-left-panel">
      <div className="beacon-stats-card">
        <div className="beacon-stats-grid">
          <div className="beacon-stat">
            <p className="beacon-stat-label">Connected</p>
            <p className="beacon-stat-value">
              {connectedCount}
              <span className="beacon-stat-total">/{totalCount}</span>
            </p>
          </div>
          <div className="beacon-stat">
            <p className="beacon-stat-label">Engine On</p>
            <p className="beacon-stat-value">
              {engineOnCount ?? 0}
              <span className="beacon-stat-total">/{totalCount}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="beacon-map-tools">
        <button className="beacon-tool-btn" onClick={onLayersClick} title="Toggle layers">
          <span className="material-symbols-outlined">layers</span>
        </button>
        <button className="beacon-tool-btn" onClick={onLocationClick} title="My location">
          <span className="material-symbols-outlined">my_location</span>
        </button>
        <button className="beacon-tool-btn" onClick={onSettings} title="GPS settings">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="beacon-zoom-controls">
          <button className="beacon-zoom-btn" onClick={onZoomIn} title="Zoom in">
            <span className="material-symbols-outlined">add</span>
          </button>
          <button className="beacon-zoom-btn" onClick={onZoomOut} title="Zoom out">
            <span className="material-symbols-outlined">remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}
