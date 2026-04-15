import { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { ToastContainer } from './components/ui/Toast';
import { AuthPage } from './components/auth/AuthPage';
import { FleetPage } from './pages/Fleet/FleetPage';
import { OperatorsPage } from './pages/Operators/OperatorsPage';
import { EarningsPage } from './pages/Earnings/EarningsPage';
import { AttendancePage } from './pages/Attendance/AttendancePage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { BillingPage } from './pages/Billing/BillingPage';
import { GPSPageNew } from './pages/GPS/GPSPageNew';
import { FuelPage } from './pages/Fuel/FuelPage';
import { CamerasPage } from './pages/Cameras/CamerasPage';
import { DiagnosticsPage } from './pages/Diagnostics/DiagnosticsPage';
import { EngineStatusPage } from './pages/EngineStatus/EngineStatusPage';
import { LoggerPage } from './pages/Logger/LoggerPage';
import { OpHistoryPage } from './pages/OpHistory/OpHistoryPage';

import { FloatingDashboard } from './components/layout/FloatingDashboard';
import { SettingsModal } from './pages/Settings/SettingsPage';
import { ErrorBoundary } from './ErrorBoundary';
import { api, clearToken, getToken } from './services/api';
import { toISO } from './utils';
import type { AppState } from './types';

export default function App() {
  const { activePage, setActivePage, sidebarCollapsed, user, setUser, userRole, setUserRole, setState, clearUserData } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          diagnostics: (raw.diagnostics || prev.diagnostics) as typeof prev.diagnostics,
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

  if (!user) {
    return <AuthPage loadDataFromAPI={loadDataFromAPI} />;
  }

  // ── Authenticated ──
  return (
    <div id="app-shell" className={`visible${sidebarCollapsed ? ' sidebar-collapsed' : ''}${userRole === 'operator' ? ' operator-mode' : ''}`}>
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
              <ErrorBoundary><GPSPageNew active={activePage === 'gps'} /></ErrorBoundary>
              <ErrorBoundary><FuelPage active={activePage === 'fuel'} /></ErrorBoundary>
              <ErrorBoundary><CamerasPage active={activePage === 'cameras'} /></ErrorBoundary>
              <ErrorBoundary><DiagnosticsPage active={activePage === 'diagnostics'} /></ErrorBoundary>
              <ErrorBoundary><EngineStatusPage active={activePage === 'engine-status'} /></ErrorBoundary>
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
      {userRole === 'operator' && <BottomNav onSignOut={handleSignOut} />}
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
