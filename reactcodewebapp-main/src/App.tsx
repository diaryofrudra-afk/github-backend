import { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { ToastContainer } from './components/ui/Toast';
import { FleetPage } from './pages/Fleet/FleetPage';
import { OperatorsPage } from './pages/Operators/OperatorsPage';
import { EarningsPage } from './pages/Earnings/EarningsPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { BillingPage } from './pages/Billing/BillingPage';
import { GPSPage } from './pages/GPS/GPSPage';
import { FuelPage } from './pages/Fuel/FuelPage';
import { CamerasPage } from './pages/Cameras/CamerasPage';
import { DiagnosticsPage } from './pages/Diagnostics/DiagnosticsPage';
import { LoggerPage } from './pages/Logger/LoggerPage';
import { OpHistoryPage } from './pages/OpHistory/OpHistoryPage';

import { FloatingDashboard } from './components/layout/FloatingDashboard';
import { SettingsModal } from './pages/Settings/SettingsPage';
import { ErrorBoundary } from './ErrorBoundary';
import { api, setToken, clearToken, getToken } from './services/api';
import { toISO } from './utils';
import type { AppState } from './types';

export default function App() {
  const { activePage, setActivePage, sidebarCollapsed, user, setUser, userRole, setUserRole, setState } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Login / register form state
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  function loadDataFromAPI() {
    api.exportAll()
      .then((data: AppState) => {
        const raw = data as unknown as Record<string, unknown>;
        // Map snake_case API fields to camelCase frontend fields
        const cranes = ((raw.cranes || []) as Record<string, unknown>[]).map(c => ({
          id: c.id, reg: c.reg, type: c.type, make: c.make, model: c.model,
          capacity: c.capacity, year: c.year, rate: c.rate,
          otRate: c.ot_rate ?? c.otRate, dailyLimit: c.daily_limit ?? c.dailyLimit,
          operator: c.operator, site: c.site, status: c.status, notes: c.notes,
        }));

        // Map timesheets: API returns flat array, frontend expects Record<operatorKey, entries[]>
        const tsRaw = raw.timesheets as Record<string, unknown[]> | unknown[] | undefined;
        let timesheets: Record<string, unknown[]> = {};
        if (Array.isArray(tsRaw)) {
          // flat array from GET /timesheets
          (tsRaw as Record<string, unknown>[]).forEach((t) => {
            const key = (t.operator_key || t.operatorKey || '') as string;
            if (!timesheets[key]) timesheets[key] = [];
            timesheets[key].push({
              id: t.id, date: toISO((t.date || '') as string),
              startTime: t.start_time ?? t.startTime,
              endTime: t.end_time ?? t.endTime,
              hoursDecimal: t.hours_decimal ?? t.hoursDecimal,
              operatorId: t.operator_id ?? t.operatorId,
              notes: t.notes,
            });
          });
        } else if (tsRaw && typeof tsRaw === 'object') {
          // already keyed by operator
          for (const [key, entries] of Object.entries(tsRaw)) {
            timesheets[key] = ((entries || []) as Record<string, unknown>[]).map(t => ({
              id: t.id, date: toISO((t.date || '') as string),
              startTime: t.start_time ?? t.startTime,
              endTime: t.end_time ?? t.endTime,
              hoursDecimal: t.hours_decimal ?? t.hoursDecimal,
              operatorId: t.operator_id ?? t.operatorId,
              notes: t.notes,
            }));
          }
        }

        setState(prev => ({
          ...prev,
          cranes: cranes as typeof prev.cranes,
          operators: (raw.operators || prev.operators) as typeof prev.operators,
          timesheets: timesheets as typeof prev.timesheets,
          files: (raw.files || prev.files) as typeof prev.files,
          fuelLogs: (raw.fuelLogs || prev.fuelLogs) as typeof prev.fuelLogs,
          cameras: (raw.cameras || prev.cameras) as typeof prev.cameras,
          clients: (raw.clients || prev.clients) as typeof prev.clients,
          invoices: (raw.invoices || prev.invoices) as typeof prev.invoices,
          payments: (raw.payments || prev.payments) as typeof prev.payments,
          creditNotes: (raw.creditNotes || prev.creditNotes) as typeof prev.creditNotes,
          quotations: (raw.quotations || prev.quotations) as typeof prev.quotations,
          proformas: (raw.proformas || prev.proformas) as typeof prev.proformas,
          challans: (raw.challans || prev.challans) as typeof prev.challans,
          compliance: (raw.compliance || prev.compliance) as typeof prev.compliance,
          maintenance: (raw.maintenance || prev.maintenance) as typeof prev.maintenance,
          notifications: (raw.notifications || prev.notifications) as typeof prev.notifications,
          attendance: (raw.attendance || prev.attendance) as typeof prev.attendance,
          ownerProfile: (raw.ownerProfile || prev.ownerProfile) as typeof prev.ownerProfile,
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
        setUser(me.phone); setUserRole(me.role); setActivePage(me.role === 'operator' ? 'logger' : 'fleet');
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
    clearToken();
    setUser(null);
    setUserRole(null);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(phone, password);
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
        loadDataFromAPI();
      } else {
        const res = await api.register(phone, password, 'owner', companyName);
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
        loadDataFromAPI();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '40px',
          minWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--fh)' }}>
            Suprwise
          </div>
          <div style={{ fontSize: '13px', color: 'var(--t3)' }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </div>

          {/* Login / Register toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '8px',
                background: mode === 'login' ? 'var(--accent)' : 'var(--bg3)',
                color: mode === 'login' ? '#fff' : 'var(--t2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '8px',
                background: mode === 'register' ? 'var(--accent)' : 'var(--bg3)',
                color: mode === 'register' ? '#fff' : 'var(--t2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Register
            </button>
          </div>


          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number"
            required
            style={{
              padding: '10px 14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--t1)',
              fontSize: '14px',
              outline: 'none',
            }}
            autoFocus
          />

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (optional)"
            style={{
              padding: '10px 14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--t1)',
              fontSize: '14px',
              outline: 'none',
            }}
          />

          {mode === 'register' && (
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Company name (optional)"
              style={{
                padding: '10px 14px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--t1)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          )}


          {authError && (
            <div style={{ fontSize: '13px', color: 'var(--error, #e53e3e)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: '6px' }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            style={{
              padding: '10px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              opacity: authLoading ? 0.7 : 1,
            }}
          >
            {authLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div id="app-shell" className={`visible${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="body-split">
      <Sidebar onSignOut={handleSignOut} />
      <div className="page-content">
        {userRole === 'owner' && (
          <>
            <ErrorBoundary><FleetPage active={activePage === 'fleet'} /></ErrorBoundary>
            <ErrorBoundary><OperatorsPage active={activePage === 'operators'} /></ErrorBoundary>
            <ErrorBoundary><EarningsPage active={activePage === 'earnings'} /></ErrorBoundary>
            <ErrorBoundary><AttendancePage active={activePage === 'attendance'} /></ErrorBoundary>
            <ErrorBoundary><AnalyticsPage active={activePage === 'analytics'} /></ErrorBoundary>
            <ErrorBoundary><BillingPage active={activePage === 'billing'} /></ErrorBoundary>
            <ErrorBoundary><GPSPage active={activePage === 'gps'} /></ErrorBoundary>
            <ErrorBoundary><FuelPage active={activePage === 'fuel'} /></ErrorBoundary>
            <ErrorBoundary><CamerasPage active={activePage === 'cameras'} /></ErrorBoundary>
            <ErrorBoundary><DiagnosticsPage active={activePage === 'diagnostics'} /></ErrorBoundary>
          </>
        )}
        {userRole === 'operator' && (
          <>
            <ErrorBoundary><LoggerPage active={activePage === 'logger'} /></ErrorBoundary>
            <ErrorBoundary><OpHistoryPage active={activePage === 'op-history'} /></ErrorBoundary>
            <ErrorBoundary><AttendancePage active={activePage === 'attendance'} /></ErrorBoundary>
          </>
        )}
      </div>
      </div>
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSignOut={handleSignOut}
      />
      <SettingsModal />
      <FloatingDashboard />
      <ToastContainer />
    </div>
  );
}
