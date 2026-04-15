import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
interface GPSAssetCardProps {
    vehicle: UnifiedVehicle;
    provider?: 'blackbuck' | 'trakntell';
    onClick: () => void;
    onHistory?: () => void;
}
export declare function GPSAssetCard({ vehicle, provider, onClick, onHistory }: GPSAssetCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSAssetCard.d.ts.map