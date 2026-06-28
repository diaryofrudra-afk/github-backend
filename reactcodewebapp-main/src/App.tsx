import { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { MobileOwnerShell } from './components/mobile/MobileOwnerShell';
import { MobileOperatorShell } from './components/mobile/MobileOperatorShell';
import { ToastContainer } from './components/ui/Toast';
import { AuthPage } from './components/auth/AuthPage';
import { FleetPage } from './pages/Fleet/FleetPage';
import { OperatorsPage } from './pages/Operators/OperatorsPage';
import { EarningsPage } from './pages/Earnings/EarningsPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { BillingPage } from './pages/Billing/BillingPage';
import { ClientsPage } from './pages/Clients/ClientsPage';
import { GPSPageNew } from './pages/GPS/GPSPageNew';
import { FuelPage } from './pages/Fuel/FuelPage';
import { CamerasPage } from './pages/Cameras/CamerasPage';
import { DocumentsPage } from './pages/Documents/DocumentsPage';
import { LoggerPage } from './pages/Logger/LoggerPage';
import { OpHistoryPage } from './pages/OpHistory/OpHistoryPage';
import { GSTVerificationPage } from './pages/GSTVerificationPage';

import { SettingsModal } from './pages/Settings/SettingsPage';
import { ErrorBoundary } from './ErrorBoundary';
import { api, clearToken, getToken } from './services/api';
import { useMobileAppMode } from './hooks/useMobileAppMode';
import { toISO } from './utils';
import type { AppState } from './types';

export default function App() {
  const { activePage, setActivePage, sidebarCollapsed, user, setUser, userRole, setUserRole, setState, clearUserData, setSettingsOpen } = useApp();
  const isMobileApp = useMobileAppMode();

  // Parse a /sync/export payload and merge it into state.
  // When `silent` is true we skip the empty-state reset and only update the
  // operator-generated collections (timesheets, attendance, files), so a
  // background refresh never flickers or clobbers in-flight owner edits.
  function applyExport(data: AppState, opts: { silent?: boolean } = {}) {
    const silent = opts.silent === true;
    const raw = data as unknown as Record<string, unknown>;
        const cranes = ((raw.cranes || []) as Record<string, unknown>[]).map(c => ({
          id: c.id, reg: c.reg, type: c.type, make: c.make, model: c.model,
          capacity: c.capacity, year: c.year, rate: c.rate,
          otRate: c.ot_rate ?? c.otRate, dailyLimit: c.daily_limit ?? c.dailyLimit,
          operator: c.operator, site: c.site, status: c.status, notes: c.notes,
          emi: Number(c.emi || 0),
          fixedExpenses: Number(c.fixed_expenses ?? c.fixedExpenses ?? 0),
        }));

        const tsRaw = raw.timesheets as Record<string, unknown[]> | unknown[] | undefined;
        const timesheets: Record<string, unknown[]> = {};
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
              craneReg: (t.crane_reg ?? t.craneReg ?? '') as string,
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
              craneReg: (t.crane_reg ?? t.craneReg ?? '') as string,
              notes: t.notes,
            }));
          }
        }

        // Transform compliance: export returns {crane_reg: {insurance_date, insurance_notes, fitness_date, fitness_notes}}
        // We need to convert to {crane_reg: {insurance?: {date, notes}, fitness?: {date, notes}}}
        const rawCompliance = raw.compliance as Record<string, Record<string, unknown>> | undefined;
        const compliance: Record<string, unknown> = {};
        if (rawCompliance && typeof rawCompliance === 'object') {
          for (const [reg, row] of Object.entries(rawCompliance)) {
            compliance[reg] = {
              insurance: row.insurance_date ? { date: row.insurance_date, notes: row.insurance_notes || '' } : undefined,
              fitness: row.fitness_date ? { date: row.fitness_date, notes: row.fitness_notes || '' } : undefined,
            };
          }
        }

        if (silent) {
          // Background refresh: only update operator-generated collections.
          setState(prev => ({
            ...prev,
            timesheets: timesheets as typeof prev.timesheets,
            attendance: (raw.attendance || prev.attendance) as typeof prev.attendance,
            files: (raw.files || prev.files) as typeof prev.files,
          }));
          return;
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
          compliance: (Object.keys(compliance).length > 0 ? compliance : prev.compliance) as typeof prev.compliance,
          maintenance: (raw.maintenance || prev.maintenance) as typeof prev.maintenance,
          notifications: (raw.notifications || prev.notifications) as typeof prev.notifications,
          attendance: (raw.attendance || prev.attendance) as typeof prev.attendance,
          ownerProfile: (raw.ownerProfile || prev.ownerProfile) as typeof prev.ownerProfile,
          operatorProfiles: (raw.operatorProfiles || prev.operatorProfiles) as typeof prev.operatorProfiles,
          advancePayments: (raw.advancePayments || prev.advancePayments) as typeof prev.advancePayments,
        }));
  }

  // Vehicle documents live in their own table (not part of /sync/export), so we
  // fetch them separately on load and on each silent refresh for the owner.
  function refreshVehicleDocuments() {
    api.getVehicleDocuments()
      .then(docs => setState(prev => ({ ...prev, vehicleDocuments: docs })))
      .catch(() => { /* ignore — keep showing current data */ });
  }

  // Full (re)load: reset to empty state, then fetch and apply the export.
  function loadDataFromAPI() {
    // Reset to empty state first — never show stale data
    setState(() => ({
      cranes: [], operators: [], operatorProfiles: {},
      ownerProfile: { name: '', roleTitle: '', phone: '', email: '', company: '', address: '', city: '', state: '', pincode: '', gst: '', pan: '', website: '', defaultLimit: '8' },
      fuelLogs: {}, cameras: [], integrations: { fuel: {}, cameras: {} },
      advancePayments: {}, vehicleDocuments: [], clients: [],
      invoices: [], payments: [], creditNotes: [],
      quotations: [], proformas: [], challans: [],
      files: {}, timesheets: {}, compliance: {},
      attendance: [], maintenance: {}, notifications: [], opNotifications: {},
    }));
    api.exportAll()
      .then((data: AppState) => applyExport(data))
      .catch(() => { /* ignore — localStorage fallback is fine */ });
    refreshVehicleDocuments();
  }

  // Silent background refresh used by the auto-refresh driver below.
  function silentRefresh() {
    api.exportAll()
      .then((data: AppState) => applyExport(data, { silent: true }))
      .catch(() => { /* ignore — keep showing current data */ });
    refreshVehicleDocuments();
  }

  // On mount: if a token exists, restore the session via /auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.me()
      .then(me => {
        setUser(me.phone);
        setUserRole(me.role);
        if (me.role === 'operator') {
          setActivePage('logger');
        } else {
          setActivePage('fleet');
        }
        loadDataFromAPI();
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setUserRole(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh: keep the owner dashboard up to date with operator-created
  // log entries (timesheets/attendance) without a manual page reload. Polls
  // every 30s and refreshes immediately when the tab regains focus.
  useEffect(() => {
    if (userRole !== 'owner' || !getToken()) return;
    const id = window.setInterval(silentRefresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') silentRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', silentRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', silentRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Scroll to top when page changes
  useEffect(() => {
    const content = document.querySelector('.page-content');
    if (content) {
      content.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activePage]);

  function handleSignOut() {
    clearUserData();
  }

  if (!user) {
    return <AuthPage loadDataFromAPI={loadDataFromAPI} />;
  }

  function renderOwnerPages() {
    if (isMobileApp) {
      switch (activePage) {
        case 'operators':
          return <ErrorBoundary><OperatorsPage active /></ErrorBoundary>;
        case 'earnings':
          return <ErrorBoundary><EarningsPage active /></ErrorBoundary>;
        case 'attendance':
          return <ErrorBoundary><AttendancePage active /></ErrorBoundary>;
        case 'analytics':
          return <ErrorBoundary><AnalyticsPage active /></ErrorBoundary>;
        case 'billing':
          return <ErrorBoundary><BillingPage active /></ErrorBoundary>;
        case 'clients':
          return <ErrorBoundary><ClientsPage active /></ErrorBoundary>;
        case 'gps':
          return <ErrorBoundary><GPSPageNew active /></ErrorBoundary>;
        case 'fuel':
          return <ErrorBoundary><FuelPage active /></ErrorBoundary>;
        case 'cameras':
          return <ErrorBoundary><CamerasPage active /></ErrorBoundary>;
        case 'diagnostics':
          return <ErrorBoundary><DocumentsPage active /></ErrorBoundary>;
        case 'gst-verification':
          return <ErrorBoundary><GSTVerificationPage active /></ErrorBoundary>;
        case 'fleet':
        default:
          return <ErrorBoundary><FleetPage active /></ErrorBoundary>;
      }
    }

    return (
      <>
        <ErrorBoundary><FleetPage active={activePage === 'fleet'} /></ErrorBoundary>
        <ErrorBoundary><OperatorsPage active={activePage === 'operators'} /></ErrorBoundary>
        <ErrorBoundary><EarningsPage active={activePage === 'earnings'} /></ErrorBoundary>
        <ErrorBoundary><AttendancePage active={activePage === 'attendance'} /></ErrorBoundary>
        <ErrorBoundary><AnalyticsPage active={activePage === 'analytics'} /></ErrorBoundary>
        <ErrorBoundary><BillingPage active={activePage === 'billing'} /></ErrorBoundary>
        <ErrorBoundary><ClientsPage active={activePage === 'clients'} /></ErrorBoundary>
        <ErrorBoundary><GPSPageNew active={activePage === 'gps'} /></ErrorBoundary>
        <ErrorBoundary><FuelPage active={activePage === 'fuel'} /></ErrorBoundary>
        <ErrorBoundary><CamerasPage active={activePage === 'cameras'} /></ErrorBoundary>
        <ErrorBoundary><DocumentsPage active={activePage === 'diagnostics'} /></ErrorBoundary>
        <ErrorBoundary><GSTVerificationPage active={activePage === 'gst-verification'} /></ErrorBoundary>
      </>
    );
  }

  function renderOperatorPages() {
    if (isMobileApp) {
      switch (activePage) {
        case 'op-history':
          return <ErrorBoundary><OpHistoryPage active /></ErrorBoundary>;
        case 'attendance':
          return <ErrorBoundary><AttendancePage active /></ErrorBoundary>;
        case 'logger':
        default:
          return <ErrorBoundary><LoggerPage active /></ErrorBoundary>;
      }
    }

    return (
      <>
        <ErrorBoundary><LoggerPage active={activePage === 'logger'} /></ErrorBoundary>
        <ErrorBoundary><OpHistoryPage active={activePage === 'op-history'} /></ErrorBoundary>
        <ErrorBoundary><AttendancePage active={activePage === 'attendance'} /></ErrorBoundary>
      </>
    );
  }

  if (isMobileApp) {
    const mobileContent = userRole === 'owner' ? renderOwnerPages() : renderOperatorPages();

    return (
      <>
        {userRole === 'owner' ? (
          <MobileOwnerShell
            activePage={activePage}
            onOpenSettings={() => setSettingsOpen(true)}
            onPageChange={setActivePage}
            onSignOut={handleSignOut}
          >
            {mobileContent}
          </MobileOwnerShell>
        ) : (
          <MobileOperatorShell activePage={activePage} onSignOut={handleSignOut}>
            {mobileContent}
          </MobileOperatorShell>
        )}
        <SettingsModal />
        <ToastContainer />
      </>
    );
  }

  // ── Authenticated ──
  return (
    <div id="app-shell" className={`visible${sidebarCollapsed ? ' sidebar-collapsed' : ''}${userRole === 'operator' ? ' operator-mode' : ''}`}>
      <div className="body-split">
        <Sidebar onSignOut={handleSignOut} />
        <div className="page-content">
          {userRole === 'owner' ? renderOwnerPages() : renderOperatorPages()}
        </div>
      </div>
      {userRole === 'operator' && <BottomNav onSignOut={handleSignOut} />}
      <SettingsModal />
      <ToastContainer />
    </div>
  );
}
