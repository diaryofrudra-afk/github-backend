import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PageId, Theme, AppState, OwnerProfile } from '../types';
import { saveKey } from '../utils';
import { useTheme } from '../hooks/useTheme';
import { useSidebar } from '../hooks/useSidebar';

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

const defaultOwnerProfile: OwnerProfile = {
  name: '', roleTitle: '', phone: '', email: '',
  company: '', city: '', state: '', gst: '', website: '', defaultLimit: '8',
};

const AppContext = createContext<AppContextValue | null>(null);

// All localStorage keys that store user data — used for clearing on sign-out
const DATA_KEYS: (keyof AppState)[] = [
  'cranes', 'operators', 'operatorProfiles', 'ownerProfile',
  'fuelLogs', 'cameras', 'integrations', 'advancePayments',
  'diagnostics', 'clients', 'invoices', 'payments', 'creditNotes',
  'quotations', 'proformas', 'challans', 'files', 'timesheets',
  'compliance', 'attendance', 'maintenance', 'notifications', 'opNotifications',
];

export function clearAllUserData(): void {
  DATA_KEYS.forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
  // Also clear auth
  try { localStorage.removeItem('suprwise_token'); } catch { /* ignore */ }
}

function emptyState(): AppState {
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePageState] = useState<PageId>(() => {
    const role = localStorage.getItem('rudra_user_role');
    return role === 'operator' ? 'logger' : 'fleet';
  });
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const [user, setUserState] = useState<string | null>(
    () => localStorage.getItem('rudra_user')
  );
  const [userRole, setUserRoleState] = useState<string | null>(
    () => localStorage.getItem('rudra_user_role')
  );
  const [appState, setAppState] = useState<AppState>(emptyState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastShiftSaved, setLastShiftSaved] = useState(0);

  const setUser = (u: string | null) => {
    setUserState(u);
    if (u) localStorage.setItem('rudra_user', u);
    else localStorage.removeItem('rudra_user');
  };

  const setUserRole = (r: string | null) => {
    setUserRoleState(r);
    if (r) localStorage.setItem('rudra_user_role', r);
    else localStorage.removeItem('rudra_user_role');
  };

  const save = useCallback(() => {
    const keys: (keyof AppState)[] = [
      'operators', 'operatorProfiles', 'cranes', 'files', 'timesheets',
      'compliance', 'attendance', 'maintenance', 'notifications', 'opNotifications',
      'fuelLogs', 'cameras', 'advancePayments', 'diagnostics', 'clients',
      'invoices', 'payments', 'creditNotes', 'quotations', 'proformas',
      'challans', 'ownerProfile',
    ];
    keys.forEach(k => saveKey(k, appState[k]));
  }, [appState]);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
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

  return (
    <AppContext.Provider value={{
      activePage, setActivePage: setActivePageState,
      theme, toggleTheme,
      sidebarCollapsed: collapsed, toggleSidebar,
      user, setUser,
      userRole, setUserRole,
      state: appState, setState: setAppState, save, clearUserData,
      toasts, showToast,
      settingsOpen, setSettingsOpen,
      lastShiftSaved, setLastShiftSaved,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
