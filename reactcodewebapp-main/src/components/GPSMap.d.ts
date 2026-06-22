import 'leaflet/dist/leaflet.css';
interface VehicleMarker {
    registration_number: string;
    status: string;
    latitude: number;
    longitude: number;
    speed?: number;
    engine_on?: boolean | null;
    ignition_status?: string;
    signal?: string;
    address?: string;
    last_updated?: string;
}
interface GPSMapProps {
    vehicles: VehicleMarker[];
    active: boolean;
}
export declare function GPSMap({ vehicles, active }: GPSMapProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSMap.d.ts.map