import { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { BottomNav } from './components/layout/BottomNav';
import { ToastContainer } from './components/ui/Toast';
import { AuthPage } from './components/auth/AuthPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { LoggerPage } from './pages/Logger/LoggerPage';
import { OpHistoryPage } from './pages/OpHistory/OpHistoryPage';
import { SettingsModal } from './pages/Settings/SettingsPage';
import { ErrorBoundary } from './ErrorBoundary';
import { api, clearToken, getToken } from './services/api';
import { toISO } from './utils';
import type { AppState, TimesheetEntry } from './types';

export default function App() {
  const {
    activePage, setActivePage,
    user, setUser, setUserRole,
    setState, clearUserData,
  } = useApp();

  function loadDataFromAPI() {
    // Reset to empty state first — never show stale data
    setState(() => ({
      cranes: [], operators: [], operatorProfiles: {},
      ownerProfile: { name: '', roleTitle: '', phone: '', email: '', company: '', city: '', state: '', gst: '', website: '', defaultLimit: '8' },
      fuelLogs: {}, cameras: [], integrations: { fuel: {}, cameras: {} },
      advancePayments: {}, diagnostics: {}, clients: [],
      invoices: [], payments: [], creditNotes: [],
      quotations: [], proformas: [], challans: [],
      files: {}, timesheets: {}, compliance: {},
      attendance: [], maintenance: {}, notifications: [], opNotifications: {},
    }));

    api.exportAll()
      .then((data: AppState) => {
        const raw = data as unknown as Record<string, unknown>;
        const cranes = ((raw.cranes || []) as Record<string, unknown>[]).map(c => ({
          id: c.id, reg: c.reg, type: c.type, make: c.make, model: c.model,
          capacity: c.capacity, year: c.year, rate: c.rate,
          otRate: c.ot_rate ?? c.otRate, dailyLimit: c.daily_limit ?? c.dailyLimit,
          operator: c.operator, site: c.site, status: c.status, notes: c.notes,
        }));

        const tsRaw = raw.timesheets as Record<string, unknown[]> | unknown[] | undefined;
        let timesheets: Record<string, TimesheetEntry[]> = {};
        if (Array.isArray(tsRaw)) {
          (tsRaw as Record<string, unknown>[]).forEach((t) => {
            const key = (t.operator_key || t.operatorKey || '') as string;
            if (!timesheets[key]) timesheets[key] = [];
            timesheets[key].push({
              id: t.id as string,
              date: toISO((t.date || '') as string),
              startTime: (t.start_time ?? t.startTime) as string,
              endTime: (t.end_time ?? t.endTime) as string,
              hoursDecimal: (t.hours_decimal ?? t.hoursDecimal) as number,
              operatorId: (t.operator_id ?? t.operatorId) as string,
              notes: t.notes as string,
            });
          });
        } else if (tsRaw && typeof tsRaw === 'object') {
          for (const [key, entries] of Object.entries(tsRaw)) {
            timesheets[key] = ((entries || []) as Record<string, unknown>[]).map(t => ({
              id: t.id as string,
              date: toISO((t.date || '') as string),
              startTime: (t.start_time ?? t.startTime) as string,
              endTime: (t.end_time ?? t.endTime) as string,
              hoursDecimal: (t.hours_decimal ?? t.hoursDecimal) as number,
              operatorId: (t.operator_id ?? t.operatorId) as string,
              notes: t.notes as string,
            }));
          }
        }

        setState(prev => ({
          ...prev,
          cranes: cranes as typeof prev.cranes,
          operators: (raw.operators || prev.operators) as typeof prev.operators,
          timesheets: timesheets as typeof prev.timesheets,
          files: (raw.files || prev.files) as typeof prev.files,
          attendance: (raw.attendance || prev.attendance) as typeof prev.attendance,
          advancePayments: (raw.advancePayments || prev.advancePayments) as typeof prev.advancePayments,
          operatorProfiles: (raw.operatorProfiles || prev.operatorProfiles) as typeof prev.operatorProfiles,
        }));
      })
      .catch(() => { /* ignore — localStorage fallback is fine */ });
  }

  // On mount: if a token exists, restore the session via /auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.me()
      .then(me => {
        setUser(me.phone);
        setUserRole(me.role);
        setActivePage('logger');
        loadDataFromAPI();
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setUserRole(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSignOut() {
    clearUserData();
  }

  if (!user) {
    return <AuthPage loadDataFromAPI={loadDataFromAPI} />;
  }

  // ── Authenticated (Operator only) ──
  return (
    <div id="app-shell" className={`visible operator-mode`}>
      <div className="body-split">
        <div className="page-content">
          <ErrorBoundary><LoggerPage active={activePage === 'logger'} /></ErrorBoundary>
          <ErrorBoundary><OpHistoryPage active={activePage === 'op-history'} /></ErrorBoundary>
          <ErrorBoundary><AttendancePage active={activePage === 'attendance'} /></ErrorBoundary>
        </div>
      </div>
      <BottomNav onSignOut={handleSignOut} />
      <SettingsModal />
      <ToastContainer />
    </div>
  );
}
