interface GPSNavBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    activeNav: string;
    onNavChange: (nav: string) => void;
    onSync: () => void;
    onSettings: () => void;
    syncing: boolean;
}
export declare function GPSNavBar({ searchQuery, onSearchChange, activeNav, onNavChange, onSync, onSettings, syncing, }: GPSNavBarProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=GPSNavBar.d.ts.map