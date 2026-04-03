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
  const { state, setState, showToast, save, user, userRole } = useApp();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const lastFetch = useRef(0);
  const isOwner = userRole === 'owner';

  // Defensive data access
  const operators = state?.operators || [];
  const timesheets = state?.timesheets || {};
  const attendance = state?.attendance || [];
  const operatorProfiles = state?.operatorProfiles || {};
  const advancePayments = state?.advancePayments || {};
  const cranes = state?.cranes || [];

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

  async function toggleAttendance(opKey: string, allKeys: string[], date: string, currentPresent: boolean) {
    if (!isOwner) return;
    const existingManual = attendance.find(a => allKeys.includes(a.operator_key) && a.date === date);
    
    try {
      if (currentPresent) {
        showToast(`Marking ${date} as Absent...`, 'info');
        const res = await api.markAttendance({ operator_key: opKey, date, status: 'absent', marked_by: 'owner' });
        setState(prev => ({
          ...prev,
          attendance: [...(prev.attendance || []).filter(a => !(allKeys.includes(a.operator_key) && a.date === date)), {
            id: String(res.id),
            operator_key: String(res.operator_key),
            date: String(res.date),
            status: String(res.status),
            marked_by: String(res.marked_by),
          }]
        }));
      } else if (existingManual && existingManual.status === 'absent') {
        showToast(`Clearing override for ${date}...`, 'info');
        await api.unmarkAttendance(opKey, date);
        setState(prev => ({
          ...prev,
          attendance: (prev.attendance || []).filter(a => !(allKeys.includes(a.operator_key) && a.date === date))
        }));
      } else {
        showToast(`Marking ${date} as Present...`, 'info');
        const res = await api.markAttendance({ operator_key: opKey, date, status: 'present', marked_by: 'owner' });
        setState(prev => ({
          ...prev,
          attendance: [...(prev.attendance || []).filter(a => !(allKeys.includes(a.operator_key) && a.date === date)), {
            id: String(res.id),
            operator_key: String(res.operator_key),
            date: String(res.date),
            status: String(res.status),
            marked_by: String(res.marked_by),
          }]
        }));
      }
      setTimeout(save, 100);
    } catch (e) {
      showToast('Attendance sync failed', 'error');
    }
  }

  const operatorsToShow = useMemo(() => {
    if (!operators) return [];
    if (isOwner) return operators;
    return operators.filter(op => op && (op.phone === user || String(op.id) === user));
  }, [isOwner, operators, user]);

  const [yr, mo] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const firstDay = new Date(yr, mo - 1, 1).getDay();
  const today = todayISO();
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const circ = 2 * Math.PI * 12;

  if (!operatorsToShow || operatorsToShow.length === 0) {
    return (
      <div className={`page ${active ? 'active' : ''}`} id="page-attendance">
        <div className="section-bar" style={{ marginBottom: '16px' }}>
          <div>
            <div className="section-title">Attendance &amp; Salary</div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px' }}>
              {isOwner ? 'Auto-marked from timesheets · Salary, advances, pending dues' : 'View your attendance and earned salary'}
            </div>
          </div>
        </div>
        <div className="empty-state" style={{ marginTop: '40px' }}>
          <p className="empty-msg" style={{ fontSize: '13px', color: 'var(--t3)' }}>
            {isOwner ? 'No operators registered yet.' : 'No attendance records found for your account.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-attendance">
      <div className="section-bar" style={{ marginBottom: '16px' }}>
        <div>
          <div className="section-title">Attendance &amp; Salary</div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--fm)', color: 'var(--t3)', marginTop: '2px' }}>
            {isOwner ? 'Auto-marked from timesheets · Salary, advances, pending dues' : 'View your attendance and earned salary'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            id="att-month-select"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ fontSize: '11px', padding: '6px 10px', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--t1)', borderRadius: 'var(--rmd)', outline: 'none', cursor: 'pointer' }}
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div id="attendance-list" className={isOwner ? '' : 'operator-sole-cal'}>
        {operatorsToShow.map(operator => {
          if (!operator) return null;
          const phone = operator.phone || '';
          const operatorKeys = [phone, String(operator.id)].filter(Boolean);
          const opKey = phone || String(operator.id);
          const profile = operatorProfiles[phone] || operatorProfiles[String(operator.id)] || {};
          const profileAny = profile as Record<string, any>;
          const salary = Number(profileAny?.salary) || 0;
          const workDays = Number(profileAny?.workingDays) || 26;
          const crane = cranes.find(c => operatorKeys.includes(String(c?.operator)));

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
          const dayHours = dayHoursMap;
          const targetHrs = 8;
          const initials = (operator.name || '??').split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || (phone ? phone.slice(-2) : '??');

          const opAdvances = (advancePayments[opKey] || []) as Array<{ id: string; date: string; amount: number; notes?: string }>;
          const monthlyAdvances = Array.isArray(opAdvances) ? opAdvances.filter(a => a?.date?.startsWith(selectedMonth)) : [];
          const totalAdvances = monthlyAdvances.reduce((s, a) => s + (Number(a?.amount) || 0), 0);
          const pendingBalance = earnedGross - totalAdvances;

          const calCells: React.ReactNode[] = [];
          for (let b = 0; b < firstDay; b++) calCells.push(<div key={`blank-${b}`}></div>);
          for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isPresent = att[iso]?.present;
            const isFuture = iso > today;
            const isToday = iso === today;
            const hrs = dayHours[iso] || 0;
            const isManualAbsent = att[iso]?.present === false;
            const isManualPresent = att[iso]?.present === true && att[iso]?.source === 'manual';
            
            const pct = isPresent ? Math.min(100, Math.max(hrs > 0 ? (hrs / targetHrs * 100) : (isPresent ? 100 : 0), isPresent ? 15 : 0)) : 0;
            const isOT = hrs > targetHrs;
            const isFull = pct >= 100;
            const isPartial = pct > 0 && pct < 100;
            const arcColor = isOT ? 'var(--green)' : isPresent ? 'var(--accent)' : 'transparent';
            const trackColor = isManualAbsent ? 'var(--red-s)' : isFuture ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)';
            const offset = (circ * (1 - pct / 100)).toFixed(2);
            const cellClass = `att-ring-cell${isFuture ? ' future' : ''}${isOT ? ' ot-day' : isFull ? ' full-day' : isPartial ? ' partial-day' : ''}${isManualAbsent ? ' manual-absent' : ''}`;
            const textColor = isManualAbsent ? 'var(--red)' : isOT ? 'var(--green)' : isPresent ? 'var(--accent)' : isFuture ? 'rgba(255,255,255,0.18)' : 'var(--t4)';
            const fontW = isToday ? '800' : isPresent ? '700' : '500';

            calCells.push(
              <div
                key={iso}
                className={cellClass}
                title={isManualAbsent ? 'Forced Absent' : isPresent ? `Present${hrs > 0 ? ` · ${hrs.toFixed(1)}h` : ''}` : isFuture ? '' : 'Absent'}
                style={{ cursor: isFuture ? 'default' : 'pointer', position: 'relative', userSelect: 'none' }}
                onMouseDown={(e) => {
                  if (isFuture) return;
                  e.preventDefault(); e.stopPropagation();
                  void toggleAttendance(opKey, operatorKeys, iso, !!isPresent);
                }}
              >
                <svg viewBox="0 0 36 36" width="38" height="38" style={{ pointerEvents: 'none' }}>
                  <circle cx="18" cy="18" r="12" fill={isManualPresent ? 'var(--accent-s)' : 'none'} stroke={trackColor} strokeWidth="4" />
                  {pct > 0 && (
                    <circle
                      cx="18" cy="18" r="12" fill="none"
                      stroke={arcColor} strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${circ.toFixed(2)}`}
                      strokeDashoffset={offset}
                      transform="rotate(-90 18 18)"
                    />
                  )}
                  {isToday && !isManualAbsent && <circle cx="18" cy="18" r="7" fill="var(--accent)" opacity="0.18" />}
                  <text
                    x="18" y="18" textAnchor="middle" dominantBaseline="central"
                    fontSize={d >= 10 ? '7.5' : '8.5'} fontWeight={fontW}
                    fontFamily="var(--fm)" fill={isToday && !isManualAbsent ? 'var(--accent)' : textColor}
                  >
                    {d}
                  </text>
                </svg>
                {isManualPresent && <div style={{ position: 'absolute', top: '4px', right: '4px', width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }} />}
              </div>
            );
          }

          return (
            <div key={operator.id} className="att-card">
              <div className="att-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="user-av" style={{ width: '36px', height: '36px', fontSize: '11px' }}>{initials}</div>
                  <div>
                    <div className="att-name">{operator.name || 'Unknown'}</div>
                    <div className="att-phone">{phone} {crane ? `· ${crane.reg}` : ''}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--fh)', fontSize: '15px', fontWeight: 800, color: 'var(--green)' }}>
                    {presentCount}/{daysInMonth}
                  </div>
                  <div style={{ fontSize: '9px', fontFamily: 'var(--fm)', color: 'var(--t3)' }}>days present</div>
                </div>
              </div>

              <div className="att-calendar">
                {dayLabels.map(l => <div key={l} className="att-day-label">{l}</div>)}
                {calCells}
              </div>

              {salary > 0 && (
                <div className="salary-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--fh)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--t2)' }}>
                      Salary Tracker · {new Date(yr, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </div>
                    {isOwner && (
                      <button 
                        className="btn-sm accent" 
                        style={{ padding: '2px 8px', fontSize: '9px' }}
                        onClick={() => {
                          const amt = prompt(`Enter advance amount for ${operator.name}:`);
                          if (!amt) return;
                          const notes = prompt('Enter notes (optional):') || '';
                          const newAdv = { id: String(Date.now()), date: todayISO(), amount: Number(amt), notes };
                          setState(prev => ({
                            ...prev,
                            advancePayments: {
                              ...(prev.advancePayments || {}),
                              [opKey]: [...((prev.advancePayments?.[opKey] || []) as any[]), newAdv]
                            }
                          }));
                          showToast(`Advance of ₹${amt} recorded for ${operator.name}`);
                          setTimeout(save, 100);
                        }}
                      >
                        + Advance
                      </button>
                    )}
                  </div>

                  <div className="salary-row">
                    <span className="salary-lbl">Monthly Salary</span>
                    <span className="salary-val">₹{salary.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="salary-row">
                    <span className="salary-lbl">Earned ({presentCount} days)</span>
                    <span className="salary-val green">₹{earnedGross.toLocaleString('en-IN')}</span>
                  </div>
                  {totalAdvances > 0 && (
                    <div className="salary-row">
                      <span className="salary-lbl">Advances Received</span>
                      <span className="salary-val red">- ₹{totalAdvances.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="salary-row" style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '8px' }}>
                    <span className="salary-lbl" style={{ fontWeight: 700 }}>Net Payable</span>
                    <span className="salary-val accent" style={{ fontSize: '14px', fontWeight: 800 }}>
                      ₹{pendingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {monthlyAdvances.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: '8px', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '4px' }}>Advance History</div>
                      {monthlyAdvances.map(adv => (
                        <div key={adv?.id || Math.random()} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--t2)', marginBottom: '2px' }}>
                          <span>{adv?.date ? new Date(adv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} {adv?.notes && `· ${adv.notes}`}</span>
                          <span style={{ fontWeight: 600 }}>₹{(adv?.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
