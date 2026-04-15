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
export declare function GPSLeftPanel({ connectedCount, totalCount, engineOnCount, onLayersClick, onLocationClick, onZoomIn, onZoomOut, onSettings, }: GPSLeftPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSLeftPanel.d.ts.map