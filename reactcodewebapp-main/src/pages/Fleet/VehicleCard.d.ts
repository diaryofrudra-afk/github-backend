import type { Crane, TimesheetEntry } from '../../types';
interface VehicleCardProps {
    crane: Crane;
    timesheets: TimesheetEntry[];
    operatorName?: string;
    alerts: string[];
    onAssign: (reg: string) => void;
    onDelete: (reg: string) => void;
    onEdit: (reg: string) => void;
}
export declare function VehicleCard({ crane, timesheets, operatorName, alerts, onAssign, onDelete, onEdit }: VehicleCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=VehicleCard.d.ts.map