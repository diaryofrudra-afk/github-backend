import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
interface GPSMapProps {
    vehicles: UnifiedVehicle[];
    onVehicleClick: (vehicle: UnifiedVehicle) => void;
    mapRef?: React.MutableRefObject<L.Map | null>;
    isDark?: boolean;
}
export declare function GPSMap({ vehicles, onVehicleClick, mapRef: externalMapRef, isDark }: GPSMapProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSMap.d.ts.map