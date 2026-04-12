import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { todayISO, toISO } from '../../utils';
import { api } from '../../services/api';
import type { TimesheetEntry, AppState } from '../../types';

function getMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

export function AttendancePage({ active }: { active: boolean }) {
  const { state, setState, user, lastShiftSaved } = useApp();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const lastFetch = useRef(0);

  const operators = state?.operators || [];
  const timesheets = state?.timesheets || {};
  const attendance = state?.attendance || [];

  useEffect(() => {
    if (!active) return;
    const forceRefresh = lastShiftSaved > lastFetch.current;
    if (!forceRefresh && Date.now() - lastFetch.current < 15000) return;
    lastFetch.current = Date.now();

    Promise.all([
      api.exportAll().catch(() => null),
      api.getAttendance().catch(() => [])
    ])
      .then(([rawAll, attRaw]) => {
        if (!rawAll && (!attRaw || !attRaw.length)) return;

        const newState: Partial<AppState> = {};

        if (rawAll) {
          const data = rawAll as AppState;
          const tsRaw = data.timesheets;

          const mappedTimesheets: Record<string, TimesheetEntry[]> = {};
          if (tsRaw && typeof tsRaw === 'object') {
            for (const [key, entries] of Object.entries(tsRaw)) {
              if (Array.isArray(entries)) {
                mappedTimesheets[key] = entries.map((t: any) => ({
                  id: String(t?.id || ''),
                  date: toISO(String(t?.date || '')),
                  startTime: String(t?.start_time ?? t?.startTime ?? ''),
                  endTime: String(t?.end_time ?? t?.endTime ?? ''),
                  hoursDecimal: Number(t?.hours_decimal ?? t?.hoursDecimal ?? 0),
                  operatorId: t?.operator_id ?? t?.operatorId,
                  notes: String(t?.notes ?? ''),
                }));
              }
            }
            newState.timesheets = mappedTimesheets;
          }

          if (data.operators) newState.operators = data.operators;
          if (data.operatorProfiles) newState.operatorProfiles = data.operatorProfiles;
          if (data.advancePayments) newState.advancePayments = data.advancePayments;
        }

        if (Array.isArray(attRaw)) {
          newState.attendance = attRaw.map(a => ({
            id: String(a?.id || ''),
            operator_key: String(a?.operator_key || ''),
            date: toISO(String(a?.date || '')) || String(a?.date || ''),
            status: String(a?.status || ''),
            marked_by: String(a?.marked_by || ''),
          }));
        }

        setState(prev => ({ ...prev, ...newState }));
      })
      .catch((err) => {
        console.error('[Attendance] Sync error:', err);
      });
  }, [active, setState, lastShiftSaved]);

  // Find the operator record matching the logged-in user (falls back to null)
  const myOperator = useMemo(
    () => operators.find(op => op && (op.phone === user || String(op.id) === user)) || null,
    [operators, user]
  );

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const firstDay = new Date(yr, mo - 1, 1).getDay();
  const today = todayISO();

  function renderOperatorView() {
    const operator = myOperator;

    // Fall back to the logged-in user's phone when no operator record exists
    const phone = operator?.phone || user || '';
    const operatorKeys = operator
      ? [operator.phone, String(operator.id)].filter(Boolean)
      : [user || ''].filter(Boolean);

    // Salary & advances
    const operatorProfiles = state?.operatorProfiles || {};
    const profile = (operatorProfiles[phone] || operatorProfiles[String(operator?.id || '')] || {}) as Record<string, unknown>;
    const salary = Number(profile?.salary) || 0;
    const workDays = Number(profile?.workingDays) || 26;
    const advancePaymentsMap = state?.advancePayments || {};
    const opKey = phone || (operator ? String(operator.id) : '');
    const opAdvances = (advancePaymentsMap[opKey] || []) as Array<{ id: string; date: string; amount: number }>;
    const currentMonthStr = `${yr}-${String(mo).padStart(2, '0')}`;
    const monthlyAdvances = Array.isArray(opAdvances) ? opAdvances.filter(a => a?.date?.startsWith(currentMonthStr)) : [];
    const totalAdvances = monthlyAdvances.reduce((s, a) => s + (Number(a?.amount) || 0), 0);

    const dayHoursMap: Record<string, number> = {};
    operatorKeys.forEach(key => {
      const entries = timesheets[key] || [];
      entries.forEach(e => {
        const iso = toISO(e?.date || '');
        if (iso) dayHoursMap[iso] = (dayHoursMap[iso] || 0) + (Number(e?.hoursDecimal) || 0);
      });
    });

    const att: Record<string, { present?: boolean; source?: string }> = {};
    for (const [iso, hrs] of Object.entries(dayHoursMap)) {
      if (hrs > 0) att[iso] = { present: true, source: 'timesheet' };
    }
    attendance.filter(a => operatorKeys.includes(a?.operator_key)).forEach(a => {
      if (a?.status === 'present') att[a.date] = { present: true, source: 'manual' };
      else if (a?.status === 'absent') att[a.date] = { present: false, source: 'manual' };
    });

    let presentCount = 0;
    let absentCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (iso > today) break;
      if (att[iso]?.present) presentCount++;
      else absentCount++;
    }
    const perDay = workDays > 0 ? salary / workDays : 0;
    const earnedGross = Math.round(perDay * presentCount);


    const monthShort = new Date(yr, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
    const dayLabelsFull = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Calculate first day offset (Monday-based: Mon=0, ..., Sun=6)
    const firstDayMon = (firstDay + 6) % 7;

    const calCells: React.ReactNode[] = [];
    for (let b = 0; b < firstDayMon; b++) calCells.push(<div key={`blank-${b}`} className="op-att-cal-blank" />);

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPresent = att[iso]?.present;
      const isFuture = iso > today;
      const isToday = iso === today;

      let cellClass = 'op-att-cal-day';
      if (isFuture) cellClass += ' op-att-cal-future';
      else if (isPresent) cellClass += ' op-att-cal-present';
      else if (isToday) cellClass += ' op-att-cal-today';

      calCells.push(
        <div key={iso} className={cellClass}>
          <span className="op-att-cal-num">{d}</span>
          {isPresent && <span className="op-att-cal-dot" />}
        </div>
      );
    }

    function shiftMonth(delta: number) {
      const d = new Date(yr, mo - 1 + delta, 1);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return (
      <div className="op-attendance-modern">
        {/* Page Header */}
        <div className="op-att-page-header">
          <div>
            <div className="op-att-page-label">Your Attendance</div>
          </div>
          <div className="op-att-header-chips">
            <div className="op-att-present-chip">
              <span className="op-att-present-num">{presentCount}</span>
              <span className="op-att-present-lbl">days present</span>
            </div>
            <div className="op-att-present-chip op-att-absent-chip">
              <span className="op-att-present-num">{absentCount}</span>
              <span className="op-att-present-lbl">days absent</span>
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="op-att-calendar-card">
          <div className="op-att-calendar-header">
            <div>
              <div className="op-att-calendar-month">{monthShort}</div>
              <div className="op-att-calendar-year">{yr}</div>
            </div>
            <div className="op-att-calendar-nav">
              <button onClick={() => shiftMonth(-1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={() => shiftMonth(1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          <div className="op-att-day-headers">
            {dayLabelsFull.map(l => (
              <div key={l} className={`op-att-day-header${l === 'Sun' ? ' op-att-day-header-sun' : ''}`}>{l}</div>
            ))}
          </div>
          <div className="op-att-cal-grid">
            {calCells}
          </div>
        </div>

        {/* Salary Tracker Card */}
        <div className="op-salary-tracker">
          <div className="op-salary-tracker-header">
            <div className="op-salary-tracker-title">
              <span className="op-salary-tracker-bar" />
              Salary Tracker
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t4)' }}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>

          {(() => {
            const displaySalary = salary > 0 ? salary : 25000;
            const displayWorkDays = workDays > 0 ? workDays : 26;
            const displayPerDay = displaySalary / displayWorkDays;
            const displayEarned = salary > 0 ? earnedGross : Math.round(displayPerDay * Math.max(presentCount, 18));
            const displayAdvance = salary > 0 ? totalAdvances : 1200;
            const displayBalance = displayEarned - displayAdvance;
            const isDemo = salary === 0;
            return (
              <>
                <div className="op-salary-row">
                  <span className="op-salary-row-label">TOTAL SALARY EARNED{isDemo ? ' (DEMO)' : ''}</span>
                  <span className="op-salary-row-value op-salary-row-earned">
                    <span className="op-salary-sign">+</span>
                    ₹{displayEarned.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="op-salary-row">
                  <span className="op-salary-row-label">ADVANCE RECEIVED{isDemo ? ' (DEMO)' : ''}</span>
                  <span className="op-salary-row-value op-salary-row-advance">
                    <span className="op-salary-sign">−</span>
                    ₹{displayAdvance.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="op-salary-divider" />

                <div className="op-salary-balance-row">
                  <span className="op-salary-balance-label">TOTAL BALANCE</span>
                  <span className={`op-salary-balance-value${displayBalance < 0 ? ' negative' : ''}`}>
                    ₹{Math.abs(displayBalance).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="op-salary-footer">
                  <span className="op-salary-footer-month">{monthShort.toUpperCase()} {yr}</span>
                  <span className="op-salary-footer-verified">
                    <span className="op-salary-verified-dot" />
                    {isDemo ? 'DEMO DATA' : 'VERIFIED'}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-attendance">
      {renderOperatorView()}
    </div>
  );
}
