import { useState, useEffect, useRef } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { ToastContainer } from './components/ui/Toast';
import { AuthPage } from './components/auth/AuthPage';
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
  const { activePage, setActivePage, sidebarCollapsed, user, setUser, userRole, setUserRole, setState, clearUserData } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auth form state
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const otpRequestRef = useRef(false);

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
        let timesheets: Record<string, unknown[]> = {};
        if (Array.isArray(tsRaw)) {
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
    clearUserData();
  }

  function startOtpTimer(expiresInMinutes: number) {
    const expiry = new Date(Date.now() + expiresInMinutes * 60_000);
    setOtpExpiresAt(expiry);
    setOtpSecondsLeft(expiresInMinutes * 60);
    const interval = setInterval(() => {
      setOtpSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return interval;
  }

  async function handleRequestOtp() {
    if (otpRequestRef.current || otpSecondsLeft > 0) return;
    otpRequestRef.current = true;
    setAuthError('');
    setAuthLoading(true);
    try {
      const purpose = mode === 'register' ? 'registration' : 'login';
      const resp = await api.sendSmsOtp(phone, purpose);
      setOtpRequested(true);
      const mins = resp.expires_in_minutes || 10;
      startOtpTimer(mins);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setAuthLoading(false);
      otpRequestRef.current = false;
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setAuthError('');

    // Step 1: Request OTP
    if (!otpRequested) {
      await handleRequestOtp();
      return;
    }

    // Step 2: Verify OTP and login/register
    setAuthLoading(true);
    try {
      if (mode === 'register') {
        // Register with OTP (single endpoint verifies OTP + creates user)
        const res = await api.registerWithOtp(phone, name, email, otp);
        clearUserData();
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage('fleet');
        loadDataFromAPI();
      } else {
        // Login: verify OTP and get token (works for both owners and operators)
        const res = await api.verifyLoginOtp(phone, otp);
        clearUserData();
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

  function resetForm() {
    setAuthError('');
    setOtpRequested(false);
    setOtp('');
    setOtpExpiresAt(null);
    setOtpSecondsLeft(0);
    otpRequestRef.current = false;
  }

  // ── Styles ──
  const inputStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '10px 14px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--t1)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    ...extra,
  });

  if (!user) {
    return <AuthPage loadDataFromAPI={loadDataFromAPI} />;
  }

  // ── Authenticated ──
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
