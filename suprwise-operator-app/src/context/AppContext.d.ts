import type { ReactNode } from 'react';
import type { PageId, Theme, AppState } from '../types';
export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warn';
}
interface AppContextValue {
    activePage: PageId;
    setActivePage: (p: PageId) => void;
    theme: Theme;
    toggleTheme: () => void;
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    user: string | null;
    setUser: (u: string | null) => void;
    userRole: string | null;
    setUserRole: (r: string | null) => void;
    state: AppState;
    setState: (updater: (prev: AppState) => AppState) => void;
    save: () => void;
    clearUserData: () => void;
    toasts: Toast[];
    showToast: (msg: string, type?: Toast['type']) => void;
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    lastShiftSaved: number;
    setLastShiftSaved: (ts: number) => void;
}
export declare function clearAllUserData(): void;
export declare function AppProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useApp(): AppContextValue;
export {};
//# sourceMappingURL=AppContext.d.ts.map