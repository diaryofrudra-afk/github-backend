import { GPSAssetCard } from './GPSAssetCard';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';

interface GPSRightPanelProps {
  vehicles: UnifiedVehicle[];
  filterQuery: string;
  onFilterChange: (query: string) => void;
  onVehicleClick: (vehicle: UnifiedVehicle) => void;
  onSync: () => void;
  onAdd: () => void;
  onSettings: () => void;
  isConfigured: boolean;
  onHistory?: (vehicle: UnifiedVehicle) => void;
  onEngineHistory?: (vehicle: UnifiedVehicle) => void;
}

export function GPSRightPanel({
  vehicles,
  filterQuery,
  onFilterChange,
  onVehicleClick,
  onSync,
  onAdd,
  onSettings,
  isConfigured,
  onHistory,
  onEngineHistory,
}: GPSRightPanelProps) {
  return (
    <div className="beacon-right-panel">
      <div className="beacon-panel-header">
        <div className="beacon-header-top">
          <h2 className="beacon-panel-title">Active Fleet</h2>
          <div className="beacon-header-actions">
            <button className="beacon-action-btn" onClick={onSync} title="Refresh GPS data">
              <span className="material-symbols-outlined">sync</span>
            </button>
            <button className="beacon-action-btn primary" onClick={onAdd} title="Sync vehicles to fleet">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>

        <div className="beacon-filter-wrapper">
          <span className="material-symbols-outlined beacon-filter-icon">filter_list</span>
          <input
            type="text"
            className="beacon-filter-input"
            placeholder="Filter by status or group..."
            value={filterQuery}
            onChange={(e) => onFilterChange(e.target.value)}
          />
          {filterQuery && (
            <button
              className="beacon-filter-clear"
              onClick={() => onFilterChange('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="beacon-asset-list">
        {!isConfigured ? (
          <div className="beacon-empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>satellite_alt</span>
            <p>No GPS provider connected</p>
            <button className="beacon-btn-primary" onClick={onSettings}>Connect Provider</button>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="beacon-empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>search_off</span>
            <p>{filterQuery ? 'No vehicles match your search' : 'No vehicles found'}</p>
            {filterQuery && (
              <button className="beacon-btn-outline" onClick={() => onFilterChange('')}>Clear search</button>
            )}
          </div>
        ) : (
          vehicles.map((vehicle) => (
            <div key={`${vehicle.provider}-${vehicle.registration_number}`} className="beacon-asset-card-wrapper">
              <GPSAssetCard
                vehicle={vehicle}
                provider={vehicle.provider}
                onClick={() => onVehicleClick(vehicle)}
                onHistory={onHistory ? () => onHistory(vehicle) : undefined}
                onEngineHistory={onEngineHistory ? () => onEngineHistory(vehicle) : undefined}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
