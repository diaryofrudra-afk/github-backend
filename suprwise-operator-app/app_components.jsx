// Operator app — crane logging for on-site operators.
// Single consistent design system used across Home, Log Shift, Fuel, Attendance.

// ─── Design tokens ─────────────────────────────────────────────
// Soft-modern SaaS with industrial warmth. Amber accent, high contrast,
// generous tap targets, gloved-hand friendly.
const TOKENS = {
  light: {
    bg:        '#F6F4EF',   // warm paper
    surface:   '#FFFFFF',
    surfaceAlt:'#EEEAE0',
    ink:       '#1A1814',
    inkMid:    '#6B6558',
    inkDim:    '#9C9584',
    line:      '#E5DFD2',
    lineStrong:'#D8D1C1',
    success:   '#2F8F5A',
    successBg: '#E3F1E8',
    danger:    '#C2452D',
  },
  dark: {
    bg:        '#17150F',
    surface:   '#23201A',
    surfaceAlt:'#1C1A14',
    ink:       '#F5F1E6',
    inkMid:    '#A8A092',
    inkDim:    '#75705F',
    line:      '#2F2B22',
    lineStrong:'#3A362B',
    success:   '#5BC28A',
    successBg: 'rgba(91,194,138,0.12)',
    danger:    '#E07159',
  },
};

// Density scales: [cardPad, gap, rowPad, titleSize]
const DENSITY = {
  compact: { cardPad: 16, gap: 10, rowPad: 12, radius: 16, touch: 52 },
  regular: { cardPad: 20, gap: 14, rowPad: 16, radius: 20, touch: 60 },
  comfy:   { cardPad: 24, gap: 18, rowPad: 20, radius: 24, touch: 68 },
};

// ─── Icons (stroke style, 24px) ────────────────────────────────
const Icon = ({ name, size = 22, color = 'currentColor', strokeWidth = 2 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:       <><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></>,
    clock:      <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar:   <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    user:       <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    fuel:       <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-2-2"/></>,
    play:       <><path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/></>,
    stop:       <><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/></>,
    check:      <><path d="M5 12l5 5L20 7"/></>,
    chevronR:   <><path d="M9 6l6 6-6 6"/></>,
    arrowL:     <><path d="M19 12H5M12 5l-7 7 7 7"/></>,
    plus:       <><path d="M12 5v14M5 12h14"/></>,
    minus:      <><path d="M5 12h14"/></>,
    pin:        <><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>,
    crane:      <><path d="M4 20V5l14 4"/><path d="M4 5h3"/><path d="M10 7.2V14"/><path d="M10 14h6"/><path d="M16 14v5"/><path d="M13 19h6"/></>,
    bolt:       <><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></>,
    drop:       <><path d="M12 3s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12z"/></>,
    bell:       <><path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  };
  return <svg {...props}>{paths[name]}</svg>;
};

// ─── Shared primitives ─────────────────────────────────────────
function Card({ children, style, c, d, elevated = false }) {
  return (
    <div style={{
      background: c.surface,
      border: `1px solid ${c.line}`,
      borderRadius: d.radius,
      padding: d.cardPad,
      boxShadow: elevated ? '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)' : 'none',
      ...style,
    }}>{children}</div>
  );
}

function SectionLabel({ children, c }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: c.inkDim,
      padding: '0 4px', marginBottom: 10,
    }}>{children}</div>
  );
}

function Pill({ children, c, tone = 'default' }) {
  const tones = {
    default: { bg: c.surfaceAlt, fg: c.inkMid, bd: c.line },
    success: { bg: c.successBg,  fg: c.success, bd: 'transparent' },
    accent:  { bg: 'rgba(217,140,42,0.12)', fg: '#D98C2A', bd: 'transparent' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 999,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em',
    }}>{children}</span>
  );
}

function PrimaryButton({ children, onClick, c, accent, fg = '#fff', icon, full = true, size = 'lg' }) {
  const h = size === 'lg' ? 60 : 48;
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      height: h,
      background: accent, color: fg,
      border: 'none', borderRadius: 16,
      fontSize: 15.5, fontWeight: 650, letterSpacing: '0.01em',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      cursor: 'pointer', padding: '0 20px',
      boxShadow: `0 1px 2px rgba(0,0,0,0.06), 0 10px 24px -12px ${accent}99`,
      WebkitTapHighlightColor: 'transparent',
      fontFamily: 'inherit',
    }}>
      {icon && <Icon name={icon} size={20}/>}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, c, icon, full = false }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      height: 48,
      background: c.surfaceAlt, color: c.ink,
      border: `1px solid ${c.line}`, borderRadius: 14,
      fontSize: 14, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: 'pointer', padding: '0 16px',
      fontFamily: 'inherit',
    }}>
      {icon && <Icon name={icon} size={18}/>}
      {children}
    </button>
  );
}

// ─── Bottom Nav ────────────────────────────────────────────────
function BottomNav({ active, onChange, c, accent }) {
  const items = [
    { id: 'home',       label: 'Home',     icon: 'home' },
    { id: 'shift',      label: 'Shift',    icon: 'clock' },
    { id: 'fuel',       label: 'Fuel',     icon: 'fuel' },
    { id: 'attendance', label: 'Me',       icon: 'user' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: c.surface, borderTop: `1px solid ${c.line}`,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      padding: '8px 8px 12px',
    }}>
      {items.map(it => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 4px', fontFamily: 'inherit',
            color: on ? accent : c.inkMid,
          }}>
            <div style={{
              width: 44, height: 28, borderRadius: 14,
              background: on ? `${accent}1f` : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={it.icon} size={20} strokeWidth={on ? 2.3 : 2}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: on ? 650 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── HOME screen ───────────────────────────────────────────────
function HomeScreen({ c, d, accent, shiftActive, onStartShift, onEndShift, shiftElapsed, go }) {
  return (
    <div style={{ padding: '18px 18px 96px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Greeting + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 4px' }}>
        <div>
          <div style={{ fontSize: 13, color: c.inkMid, fontWeight: 500 }}>Tuesday · 24 Apr</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: c.ink, letterSpacing: '-0.02em', marginTop: 2 }}>
            Good morning, A.
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: c.surface, border: `1px solid ${c.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <Icon name="bell" size={20} color={c.inkMid}/>
          <div style={{
            position: 'absolute', top: 10, right: 11,
            width: 8, height: 8, borderRadius: 4, background: accent,
            border: `2px solid ${c.surface}`,
          }}/>
        </div>
      </div>

      {/* Current machine card — the hero */}
      <div>
        <SectionLabel c={c}>Assigned Machine</SectionLabel>
        <Card c={c} d={d} elevated>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 56, height: 56, flexShrink: 0,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="crane" size={28} color="#fff" strokeWidth={2}/>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: c.ink, letterSpacing: '-0.01em' }}>
                  Crawler 250T
                </div>
                <div style={{ fontSize: 13, color: c.inkMid, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="pin" size={13}/>
                  <span>Unit MH-12 · North Yard</span>
                </div>
              </div>
            </div>
            {shiftActive && <Pill c={c} tone="success"><span style={{ width: 6, height: 6, borderRadius: 3, background: c.success }}/>Running</Pill>}
          </div>

          {/* Stat strip */}
          <div style={{
            marginTop: 18,
            background: c.surfaceAlt,
            borderRadius: 14,
            padding: '14px 4px',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          }}>
            {[
              { lbl: 'Today', val: shiftActive ? fmtElapsed(shiftElapsed) : '0:00', sub: 'hours' },
              { lbl: 'Fuel',  val: '45', sub: 'liters' },
              { lbl: 'Week',  val: '32.5', sub: 'hours' },
            ].map((s, i) => (
              <div key={s.lbl} style={{
                padding: '0 14px',
                borderLeft: i > 0 ? `1px solid ${c.line}` : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: c.inkDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.lbl}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.ink, marginTop: 4, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: c.inkMid, marginTop: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Primary action */}
          <div style={{ marginTop: 16 }}>
            {!shiftActive ? (
              <PrimaryButton c={c} accent={accent} icon="play" onClick={onStartShift}>
                Start Shift
              </PrimaryButton>
            ) : (
              <PrimaryButton c={c} accent={c.ink} fg={c.bg} icon="stop" onClick={onEndShift}>
                End Shift · {fmtElapsed(shiftElapsed)}
              </PrimaryButton>
            )}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <SectionLabel c={c}>Quick Log</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <QuickTile c={c} d={d} accent={accent} icon="fuel"    label="Log Fuel"       sub="Refill or usage" onClick={() => go('fuel')}/>
          <QuickTile c={c} d={d} accent={accent} icon="calendar" label="Attendance"    sub="Mark present"    onClick={() => go('attendance')}/>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <SectionLabel c={c}>Recent Activity</SectionLabel>
        <Card c={c} d={d} style={{ padding: 4 }}>
          {[
            { icon: 'clock',    title: 'Shift completed', sub: 'Mon · 24 Apr, 18:30', val: '8h 30m', tone: 'success', tag: 'Approved' },
            { icon: 'fuel',     title: 'Fuel refilled',    sub: 'Mon · 24 Apr, 10:15', val: '120 L',  tone: 'default', tag: 'Unit MH-12' },
            { icon: 'calendar', title: 'Attendance marked',sub: 'Mon · 24 Apr, 08:00', val: 'On time', tone: 'default', tag: 'Present' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderBottom: i < arr.length - 1 ? `1px solid ${c.line}` : 'none',
            }}>
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                borderRadius: 12, background: c.surfaceAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={r.icon} size={18} color={c.inkMid}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: c.ink }}>{r.title}</div>
                <div style={{ fontSize: 12, color: c.inkDim, marginTop: 1 }}>{r.sub}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, fontVariantNumeric: 'tabular-nums' }}>{r.val}</div>
                <div style={{ fontSize: 11, color: r.tone === 'success' ? c.success : c.inkMid, fontWeight: 600, marginTop: 1 }}>{r.tag}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function QuickTile({ c, d, accent, icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left',
      background: c.surface, border: `1px solid ${c.line}`,
      borderRadius: d.radius, padding: 16,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 104,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `${accent}1c`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={20} color={accent}/>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 650, color: c.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: c.inkMid, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

// ─── SHIFT screen ──────────────────────────────────────────────
function ShiftScreen({ c, d, accent, shiftActive, shiftElapsed, onStartShift, onEndShift, go }) {
  return (
    <div style={{ padding: '18px 18px 96px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <ScreenHeader c={c} title="Shift" sub={shiftActive ? 'In progress' : 'Not started'} onBack={() => go('home')}/>

      {/* Timer card */}
      <Card c={c} d={d} elevated style={{ textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: c.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {shiftActive ? 'Elapsed' : 'Ready to start'}
        </div>
        <div style={{
          fontSize: 64, fontWeight: 700, color: c.ink, letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums', marginTop: 8, lineHeight: 1,
        }}>
          {fmtElapsed(shiftActive ? shiftElapsed : 0)}
        </div>
        <div style={{ fontSize: 13, color: c.inkMid, marginTop: 6 }}>
          {shiftActive ? `Started at ${new Date(Date.now() - shiftElapsed * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Tap below when you begin operating'}
        </div>

        {/* Ring / progress */}
        <div style={{ marginTop: 22, height: 6, borderRadius: 3, background: c.surfaceAlt, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (shiftElapsed / (8 * 3600)) * 100)}%`,
            background: accent,
            transition: 'width 0.4s',
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.inkDim, marginTop: 6, fontWeight: 500 }}>
          <span>0h</span><span>Target 8h</span>
        </div>

        <div style={{ marginTop: 24 }}>
          {!shiftActive ? (
            <PrimaryButton c={c} accent={accent} icon="play" onClick={onStartShift}>Start Shift</PrimaryButton>
          ) : (
            <PrimaryButton c={c} accent={c.ink} fg={c.bg} icon="stop" onClick={onEndShift}>End Shift</PrimaryButton>
          )}
        </div>
      </Card>

      {/* Machine context */}
      <Card c={c} d={d}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: c.surfaceAlt, color: c.inkMid,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="crane" size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Operating</div>
            <div style={{ fontSize: 16, fontWeight: 650, color: c.ink, marginTop: 2 }}>Crawler 250T · MH-12</div>
          </div>
          <Icon name="chevronR" size={20} color={c.inkDim}/>
        </div>
      </Card>

      {/* Past shifts */}
      <div>
        <SectionLabel c={c}>This week</SectionLabel>
        <Card c={c} d={d} style={{ padding: 4 }}>
          {[
            { day: 'Mon 24',  hrs: '8h 30m', status: 'Approved' },
            { day: 'Sun 23',  hrs: 'Off',    status: '—',        off: true },
            { day: 'Sat 22',  hrs: '7h 45m', status: 'Approved' },
            { day: 'Fri 21',  hrs: '8h 15m', status: 'Approved' },
            { day: 'Thu 20',  hrs: '8h 00m', status: 'Approved' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              borderBottom: i < arr.length - 1 ? `1px solid ${c.line}` : 'none',
            }}>
              <div style={{ fontSize: 13, color: c.inkMid, width: 72, fontWeight: 600, flexShrink: 0 }}>{r.day}</div>
              <div style={{ flex: 1, fontSize: 15, fontWeight: r.off ? 500 : 650, color: r.off ? c.inkDim : c.ink, fontVariantNumeric: 'tabular-nums' }}>{r.hrs}</div>
              <div style={{ fontSize: 12, color: r.off ? c.inkDim : c.success, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{r.status}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── FUEL screen ───────────────────────────────────────────────
function FuelScreen({ c, d, accent, go }) {
  const [liters, setLiters] = React.useState(45);
  const [type, setType] = React.useState('refill');
  return (
    <div style={{ padding: '18px 18px 96px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <ScreenHeader c={c} title="Log Fuel" sub="Crawler 250T · MH-12" onBack={() => go('home')}/>

      {/* Type toggle */}
      <Card c={c} d={d} style={{ padding: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: type === 'refill' ? 0 : '50%', width: '50%',
            background: c.ink, borderRadius: 12,
            transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}/>
          {[{ id: 'refill', label: 'Refill' }, { id: 'consumption', label: 'Consumption' }].map(o => (
            <button key={o.id} onClick={() => setType(o.id)} style={{
              position: 'relative', zIndex: 1,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '12px', borderRadius: 12,
              fontSize: 14, fontWeight: 650,
              color: type === o.id ? c.bg : c.inkMid,
              fontFamily: 'inherit',
              transition: 'color 0.2s',
            }}>{o.label}</button>
          ))}
        </div>
      </Card>

      {/* Liters stepper — big, gloved-finger friendly */}
      <Card c={c} d={d} elevated>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Amount</div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
            marginTop: 16,
          }}>
            <StepperBtn c={c} icon="minus" onClick={() => setLiters(Math.max(0, liters - 5))}/>
            <div style={{ minWidth: 120 }}>
              <div style={{
                fontSize: 56, fontWeight: 700, color: c.ink, letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>{liters}</div>
              <div style={{ fontSize: 13, color: c.inkMid, marginTop: 4, fontWeight: 600 }}>liters</div>
            </div>
            <StepperBtn c={c} icon="plus" onClick={() => setLiters(liters + 5)}/>
          </div>

          {/* Quick preset chips */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {[20, 50, 100, 150, 200].map(v => (
              <button key={v} onClick={() => setLiters(v)} style={{
                padding: '8px 14px', borderRadius: 999,
                background: liters === v ? c.ink : c.surfaceAlt,
                color: liters === v ? c.bg : c.inkMid,
                border: `1px solid ${liters === v ? c.ink : c.line}`,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{v}L</button>
            ))}
          </div>
        </div>
      </Card>

      {/* Meta fields */}
      <Card c={c} d={d} style={{ padding: 4 }}>
        <FieldRow c={c} label="Odometer / Hourmeter" value="1,284 hrs" icon="clock"/>
        <FieldRow c={c} label="Source"               value="Yard Tank 2"  icon="drop"/>
        <FieldRow c={c} label="Time"                 value="Now · 10:42"  icon="calendar" last/>
      </Card>

      <PrimaryButton c={c} accent={accent} icon="check" onClick={() => go('home')}>
        Submit {type === 'refill' ? 'Refill' : 'Consumption'}
      </PrimaryButton>
    </div>
  );
}

function StepperBtn({ c, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 60, height: 60, borderRadius: '50%',
      background: c.surfaceAlt, border: `1px solid ${c.line}`,
      color: c.ink, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit',
    }}>
      <Icon name={icon} size={24} strokeWidth={2.5}/>
    </button>
  );
}

function FieldRow({ c, label, value, icon, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
      borderBottom: last ? 'none' : `1px solid ${c.line}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: c.surfaceAlt, color: c.inkMid,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={17}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: c.inkDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.ink, marginTop: 2 }}>{value}</div>
      </div>
      <Icon name="chevronR" size={18} color={c.inkDim}/>
    </div>
  );
}

// ─── ATTENDANCE screen ─────────────────────────────────────────
function AttendanceScreen({ c, d, accent, attendance, onMark, go }) {
  const days = Array.from({ length: 30 }).map((_, i) => {
    const statuses = ['present','present','present','present','off','present','present','present','absent','present'];
    return {
      day: i + 1,
      status: i === 23 ? 'today' : statuses[i % statuses.length],
    };
  });
  return (
    <div style={{ padding: '18px 18px 96px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <ScreenHeader c={c} title="Attendance" sub="April 2026" onBack={() => go('home')}/>

      {/* Today card */}
      <Card c={c} d={d} elevated>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: attendance ? c.successBg : c.surfaceAlt,
            color: attendance ? c.success : c.inkMid,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={attendance ? 'check' : 'calendar'} size={26} strokeWidth={2.5}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Today</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: c.ink, marginTop: 2, letterSpacing: '-0.01em' }}>
              {attendance ? 'Present · On site' : 'Not yet marked'}
            </div>
            <div style={{ fontSize: 13, color: c.inkMid, marginTop: 2 }}>
              {attendance ? 'Checked in 08:02 · North Yard' : 'Tap below to check in'}
            </div>
          </div>
        </div>
        {!attendance && (
          <div style={{ marginTop: 16 }}>
            <PrimaryButton c={c} accent={accent} icon="pin" onClick={onMark}>
              Mark Present
            </PrimaryButton>
          </div>
        )}
      </Card>

      {/* Month summary */}
      <Card c={c} d={d}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { lbl: 'Present', val: 21, tone: c.success },
            { lbl: 'Off',     val: 3,  tone: c.inkMid },
            { lbl: 'Absent',  val: 1,  tone: c.danger },
          ].map((s, i) => (
            <div key={s.lbl} style={{
              padding: '4px 12px',
              borderLeft: i > 0 ? `1px solid ${c.line}` : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: s.tone, marginTop: 2 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Calendar */}
      <div>
        <SectionLabel c={c}>Month view</SectionLabel>
        <Card c={c} d={d}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: c.inkDim, textAlign: 'center', fontWeight: 600 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {days.map(d => {
              let bg, fg, bd = 'transparent';
              if (d.status === 'today')   { bg = accent; fg = '#fff'; }
              else if (d.status === 'present') { bg = c.successBg; fg = c.success; }
              else if (d.status === 'absent')  { bg = 'rgba(194,69,45,0.1)'; fg = c.danger; }
              else                             { bg = c.surfaceAlt; fg = c.inkDim; }
              return (
                <div key={d.day} style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  background: bg, color: fg,
                  border: `1px solid ${bd}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
                }}>{d.day}</div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { lbl: 'Present', bg: c.successBg, fg: c.success },
              { lbl: 'Off',     bg: c.surfaceAlt, fg: c.inkDim },
              { lbl: 'Absent',  bg: 'rgba(194,69,45,0.1)', fg: c.danger },
            ].map(l => (
              <div key={l.lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: l.bg, border: `1px solid ${l.fg}30` }}/>
                <span style={{ fontSize: 11.5, color: c.inkMid, fontWeight: 500 }}>{l.lbl}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Shared screen header ──────────────────────────────────────
function ScreenHeader({ c, title, sub, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 4px' }}>
      <button onClick={onBack} style={{
        width: 44, height: 44, borderRadius: 14,
        background: c.surface, border: `1px solid ${c.line}`,
        cursor: 'pointer', color: c.ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit',
      }}>
        <Icon name="arrowL" size={20}/>
      </button>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: c.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: c.inkMid, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────
function fmtElapsed(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

Object.assign(window, {
  HomeScreen, ShiftScreen, FuelScreen, AttendanceScreen,
  BottomNav, TOKENS, DENSITY,
});
