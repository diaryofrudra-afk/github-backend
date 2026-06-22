import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { toISO } from '../../utils';
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
  const { state, setState, userRole } = useApp();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const lastFetch = useRef(0);
  const isOwner = userRole === 'owner';

  const operators = state?.operators || [];
  const timesheets = state?.timesheets || {};
  const attendance = state?.attendance || [];
  const operatorProfiles = state?.operatorProfiles || {};
  const advancePayments = state?.advancePayments || {};

  useEffect(() => {
    if (!active) return;
    if (Date.now() - lastFetch.current < 15000) return;
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
                  craneReg: String(t?.crane_reg ?? t?.craneReg ?? ''),
                  notes: String(t?.notes ?? ''),
                }));
              }
            }
            newState.timesheets = mappedTimesheets;
          }

          if (data.operators) newState.operators = data.operators;
          if (data.operatorProfiles) newState.operatorProfiles = data.operatorProfiles;
          if (data.cranes) newState.cranes = data.cranes;
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
  }, [active, setState]);

  const operatorsToShow = isOwner ? operators : operators.filter(o => o.phone === state.ownerProfile.phone || o.id === state.ownerProfile.phone); // Simplified for operator self-view

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // ── Owner render: per-operator ring calendar cards ──
  function renderOwnerView() {
    return (
      <>
        <header className="page-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="header-left">
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', margin: 0 }}>Attendance</h2>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Auto-marked from timesheets · Salary and advances</p>
          </div>
          
          <div className="header-right">
            <select
              id="att-month-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ fontSize: 13, padding: '10px 16px', border: '1px solid var(--border)', background: 'var(--bg4)', color: 'var(--t1)', borderRadius: 12, outline: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </header>

        <div id="attendance-list">
          {operatorsToShow.map(operator => {
            if (!operator) return null;
            const phone = operator.phone || '';
            const operatorKeys = [phone, String(operator.id)].filter(Boolean);
            const opKey = phone || String(operator.id);
            const profile = operatorProfiles[phone] || operatorProfiles[String(operator.id)] || {};
            const profileAny = profile as Record<string, any>;
            const salary = Number(profileAny?.salary) || 0;
            const workDays = Number(profileAny?.workingDays) || 26;

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
            for (let d = 1; d <= daysInMonth; d++) {
              const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              if (att[iso]?.present) presentCount++;
            }

            const perDay = workDays > 0 ? salary / workDays : 0;
            const earnedGross = Math.round(perDay * presentCount);
            const initials = (operator.name || '??').slice(0, 2).toUpperCase();

            const opAdvances = (advancePayments[opKey] || []) as Array<{ id: string; date: string; amount: number; notes?: string }>;
            const monthlyAdvances = Array.isArray(opAdvances) ? opAdvances.filter(a => a?.date?.startsWith(selectedMonth)) : [];
            const totalAdvances = monthlyAdvances.reduce((s, a) => s + (Number(a?.amount) || 0), 0);
            const pendingBalance = earnedGross - totalAdvances;

            return (
              <div key={opKey} className="attendance-card" style={{ background: 'var(--bg4)', borderRadius: 24, padding: 24, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-grd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800 }}>
                      {initials}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>{operator.name || 'Operator'}</h3>
                      <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{phone}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>₹{earnedGross.toLocaleString('en-IN')}</div>
                    <p style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, marginTop: 4 }}>Earned this month</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16, background: 'var(--bg5)', borderRadius: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Present</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>{presentCount} days</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Advances</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>₹{totalAdvances.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Pending</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>₹{pendingBalance.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  function renderOperatorView() {
    return (
      <>
        <header className="page-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="header-left">
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em', margin: 0 }}>My Attendance</h2>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>View your records and earned salary</p>
          </div>
          <div className="header-right">
            <select
              className="att-month-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ fontSize: 13, padding: '10px 16px', border: '1px solid var(--border)', background: 'var(--bg4)', color: 'var(--t1)', borderRadius: 12, outline: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </header>
        {/* Simplified calendar or stats for operator ... */}
        <div style={{ padding: 24, background: 'var(--bg4)', borderRadius: 24, border: '1px solid var(--border)', textAlign: 'center' }}>
           <p style={{ color: 'var(--t2)' }}>Attendance details for the selected month will appear here.</p>
        </div>
      </>
    );
  }

  return (
    <div className={`page attendance-page ${active ? 'active' : ''}`} id="page-attendance">
      {isOwner ? renderOwnerView() : renderOperatorView()}
    </div>
  );
}
