import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
import { saveKey } from '../utils';
import { useTheme } from '../hooks/useTheme';
import { useSidebar } from '../hooks/useSidebar';
const defaultOwnerProfile = {
    name: '', roleTitle: '', phone: '', email: '',
    company: '', city: '', state: '', gst: '', website: '', defaultLimit: '8',
};
const AppContext = createContext(null);
// All localStorage keys that store user data — used for clearing on sign-out
const DATA_KEYS = [
    'cranes', 'operators', 'operatorProfiles', 'ownerProfile',
    'fuelLogs', 'cameras', 'integrations', 'advancePayments',
    'diagnostics', 'clients', 'invoices', 'payments', 'creditNotes',
    'quotations', 'proformas', 'challans', 'files', 'timesheets',
    'compliance', 'attendance', 'maintenance', 'notifications', 'opNotifications',
];
export function clearAllUserData() {
    DATA_KEYS.forEach(key => {
        try {
            localStorage.removeItem(key);
        }
        catch { /* ignore */ }
    });
    // Also clear auth
    try {
        localStorage.removeItem('suprwise_token');
    }
    catch { /* ignore */ }
}
function emptyState() {
    return {
        cranes: [],
        operators: [],
        operatorProfiles: {},
        ownerProfile: { ...defaultOwnerProfile },
        fuelLogs: {},
        cameras: [],
        integrations: { fuel: {}, cameras: {} },
        advancePayments: {},
        diagnostics: {},
        clients: [],
        invoices: [],
        payments: [],
        creditNotes: [],
        quotations: [],
        proformas: [],
        challans: [],
        files: {},
        timesheets: {},
        compliance: {},
        attendance: [],
        maintenance: {},
        notifications: [],
        opNotifications: {},
    };
}
export function AppProvider({ children }) {
    const [activePage, setActivePageState] = useState(() => {
        const role = localStorage.getItem('rudra_user_role');
        return role === 'operator' ? 'logger' : 'fleet';
    });
    const { theme, toggleTheme } = useTheme();
    const { collapsed, toggle: toggleSidebar } = useSidebar();
    const [user, setUserState] = useState(() => localStorage.getItem('rudra_user'));
    const [userRole, setUserRoleState] = useState(() => localStorage.getItem('rudra_user_role'));
    const [appState, setAppState] = useState(emptyState);
    const [toasts, setToasts] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [lastShiftSaved, setLastShiftSaved] = useState(0);
    const setUser = (u) => {
        setUserState(u);
        if (u)
            localStorage.setItem('rudra_user', u);
        else
            localStorage.removeItem('rudra_user');
    };
    const setUserRole = (r) => {
        setUserRoleState(r);
        if (r)
            localStorage.setItem('rudra_user_role', r);
        else
            localStorage.removeItem('rudra_user_role');
    };
    const save = useCallback(() => {
        const keys = [
            'operators', 'operatorProfiles', 'cranes', 'files', 'timesheets',
            'compliance', 'attendance', 'maintenance', 'notifications', 'opNotifications',
            'fuelLogs', 'cameras', 'advancePayments', 'diagnostics', 'clients',
            'invoices', 'payments', 'creditNotes', 'quotations', 'proformas',
            'challans', 'ownerProfile',
        ];
        keys.forEach(k => saveKey(k, appState[k]));
    }, [appState]);
    const showToast = useCallback((msg, type = 'success') => {
        const id = String(Date.now());
        setToasts(prev => [...prev, { id, message: msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);
    const clearUserData = useCallback(() => {
        clearAllUserData();
        setAppState(emptyState());
        setUserState(null);
        setUserRoleState(null);
        localStorage.removeItem('rudra_user');
        localStorage.removeItem('rudra_user_role');
    }, []);
    return (_jsx(AppContext.Provider, { value: {
            activePage, setActivePage: setActivePageState,
            theme, toggleTheme,
            sidebarCollapsed: collapsed, toggleSidebar,
            user, setUser,
            userRole, setUserRole,
            state: appState, setState: setAppState, save, clearUserData,
            toasts, showToast,
            settingsOpen, setSettingsOpen,
            lastShiftSaved, setLastShiftSaved,
        }, children: children }));
}
export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx)
        throw new Error('useApp must be used within AppProvider');
    return ctx;
}
//# sourceMappingURL=AppContext.js.map