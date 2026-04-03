import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PageId, Theme, AppState, OwnerProfile } from '../types';
import { safeLoad, saveKey } from '../utils';
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
  toasts: Toast[];
  showToast: (msg: string, type?: Toast['type']) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const defaultOwnerProfile: OwnerProfile = {
  name: '', roleTitle: '', phone: '', email: '',
  company: '', city: '', state: '', gst: '', website: '', defaultLimit: '8',
};

function loadInitialState(): AppState {
  return {
    cranes: safeLoad('cranes', []),
    operators: safeLoad('operators', []),
    operatorProfiles: safeLoad('operatorProfiles', {}),
    ownerProfile: safeLoad('ownerProfile', defaultOwnerProfile),
    fuelLogs: safeLoad('fuelLogs', {}),
    cameras: safeLoad('cameras', []),
    integrations: safeLoad('integrations', { fuel: {}, cameras: {} }),
    advancePayments: safeLoad('advancePayments', {}),
    diagnostics: safeLoad('diagnostics', {}),
    clients: safeLoad('clients', []),
    invoices: safeLoad('invoices', []),
    payments: safeLoad('payments', []),
    creditNotes: safeLoad('creditNotes', []),
    quotations: safeLoad('quotations', []),
    proformas: safeLoad('proformas', []),
    challans: safeLoad('challans', []),
    files: safeLoad('files', {}),
    timesheets: safeLoad('timesheets', {}),
    compliance: safeLoad('compliance', {}),
    attendance: safeLoad('attendance', []),
    maintenance: safeLoad('maintenance', {}),
    notifications: safeLoad('notifications', []),
    opNotifications: safeLoad('opNotifications', {}),
  };
}

const AppContext = createContext<AppContextValue | null>(null);

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
  const [appState, setAppState] = useState<AppState>(loadInitialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <AppContext.Provider value={{
      activePage, setActivePage: setActivePageState,
      theme, toggleTheme,
      sidebarCollapsed: collapsed, toggleSidebar,
      user, setUser,
      userRole, setUserRole,
      state: appState, setState: setAppState, save,
      toasts, showToast,
      settingsOpen, setSettingsOpen,
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
