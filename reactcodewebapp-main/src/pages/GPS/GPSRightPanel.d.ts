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
}
export declare function GPSRightPanel({ vehicles, filterQuery, onFilterChange, onVehicleClick, onSync, onAdd, onSettings, isConfigured, onHistory, }: GPSRightPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSRightPanel.d.ts.map