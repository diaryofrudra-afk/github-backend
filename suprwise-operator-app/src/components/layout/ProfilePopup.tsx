import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { Settings, Moon, LogOut, ChevronRight } from 'lucide-react';

interface ProfilePopupProps {
  opName: string;
  opPhone: string;
  opPhoto: string;
  initials: string;
  isDark: boolean;
  onSettings: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  positionStyle?: CSSProperties;
  pointerStyle?: CSSProperties;
}

// Translating the reference Tailwind exactly to inline styles
const S = {
  // Container — matches: rounded-3xl bg-white/60 backdrop-blur-xl border border-white/30 shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden
  card: {
    position: 'fixed' as const,
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
    right: 'max(16px, calc((100vw - 420px) / 2 + 8px))',
    width: 'min(600px, calc(100vw - 32px))',
    borderRadius: 24,                                   // rounded-3xl
    background: 'rgba(255,255,255,0.60)',               // bg-white/60
    backdropFilter: 'blur(24px) saturate(180%)',        // backdrop-blur-xl + ⚡bonus saturate
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.30)',         // border border-white/30
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',          // shadow-[0_20px_60px_rgba(0,0,0,0.15)]
    overflow: 'hidden' as const,
    zIndex: 760,
  },
  // Header — matches: flex items-center gap-3 p-4
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,                                            // gap-3
    padding: 16,                                        // p-4
    cursor: 'pointer',
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left' as const,
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
  },
  // Avatar — matches: w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold shadow-lg
  avatar: {
    width: 48, height: 48,                              // w-12 h-12
    borderRadius: '50%',                                // rounded-full
    background: 'linear-gradient(135deg, #fb923c, #ea580c)', // from-orange-400 to-orange-600
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 600, fontSize: 15,      // text-white font-semibold
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',          // shadow-lg
    flexShrink: 0,
    fontFamily: 'var(--fh)',
  },
  // Name — matches: font-semibold text-gray-900
  name: {
    fontWeight: 600, fontSize: 15,
    color: '#111827',                                   // text-gray-900
    margin: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  // Status row — matches: flex items-center gap-1 text-sm text-gray-500
  statusRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }, // w-2 h-2 bg-green-500
  statusText: { fontSize: 13, color: '#6b7280' },      // text-sm text-gray-500
  // Separator — matches: h-px bg-gray-200/50 mx-4
  sep: { height: 1, background: 'rgba(209,213,219,0.5)', margin: '0 16px' }, // bg-gray-200/50
  // Menu container — matches: p-2 space-y-1
  menu: { padding: 8, display: 'flex', flexDirection: 'column' as const, gap: 4 },
  // Row base — matches: flex items-center justify-between w-full px-3 py-3 rounded-xl
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '12px 12px',               // px-3 py-3
    borderRadius: 12,                                   // rounded-xl
    background: 'none', border: 'none', cursor: 'pointer',
    transition: 'background 0.15s, transform 0.1s',
    transformOrigin: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  // Left side of row — matches: flex items-center gap-3 text-gray-800
  rowLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 14, fontWeight: 500, color: '#1f2937' }, // text-gray-800
  // Pointer tail — rendered as a layered triangle to mimic the comic bubble notch
  pointer: {
    position: 'absolute' as const,
    bottom: -14,
    right: 24,
    width: 0,
    height: 0,
    pointerEvents: 'none' as const,
    zIndex: 1,
  },
  pointerOuter: {
    position: 'relative' as const,
    width: 0,
    height: 0,
    borderLeft: '14px solid transparent',
    borderRight: '14px solid transparent',
    borderTop: '14px solid rgba(255,255,255,0.30)',
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))',
  },
  pointerInner: {
    position: 'absolute' as const,
    top: -13,
    left: -12,
    width: 0,
    height: 0,
    borderLeft: '12px solid transparent',
    borderRight: '12px solid transparent',
    borderTop: '12px solid rgba(255,255,255,0.60)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  },
} as const;

function rowHover(e: React.MouseEvent<HTMLElement>, bg = 'rgba(255,255,255,0.45)') {
  (e.currentTarget as HTMLElement).style.background = bg;
  (e.currentTarget as HTMLElement).style.transform = 'scale(1.015)';
}
function rowOut(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'none';
  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
}
function rowPress(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
}
function rowRelease(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.transform = 'scale(1.015)';
}

export function ProfilePopup({
  opName, opPhone, opPhoto, initials,
  isDark, onSettings, onToggleTheme, onLogout,
  positionStyle, pointerStyle,
}: ProfilePopupProps) {
  const displayName = opName || opPhone;
  const displaySub  = opName ? opPhone : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ ...S.card, ...positionStyle }}
    >
      {/* Header — tappable row with ChevronRight (as seen in image) */}
      <button
        style={S.header}
        onClick={onSettings}
        onMouseEnter={e => rowHover(e, 'rgba(255,255,255,0.25)')}
        onMouseLeave={rowOut}
        onMouseDown={rowPress}
        onMouseUp={rowRelease}
      >
        {/* Avatar — w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 */}
        {opPhoto ? (
          <img src={opPhoto} alt="" style={{ ...S.avatar, objectFit: 'cover' } as React.CSSProperties} />
        ) : (
          <div style={S.avatar}>{initials}</div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* font-semibold text-gray-900 */}
          <p style={S.name}>{displayName}</p>
          {/* flex items-center gap-1 text-sm text-gray-500 */}
          <div style={S.statusRow}>
            <span style={S.dot} />
            <span style={S.statusText}>{displaySub || 'Active Operator'}</span>
          </div>
        </div>

        {/* ChevronRight visible in the mockup image */}
        <ChevronRight size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
      </button>

      {/* h-px bg-gray-200/50 mx-4 */}
      <div style={S.sep} />

      {/* p-2 space-y-1 */}
      <div style={S.menu}>

        {/* Account settings — hover:bg-white/40 */}
        <button
          style={S.row}
          onClick={onSettings}
          onMouseEnter={e => rowHover(e)}
          onMouseLeave={rowOut}
          onMouseDown={rowPress}
          onMouseUp={rowRelease}
        >
          <div style={S.rowLeft}>
            <Settings size={18} color="#f97316" />   {/* text-orange-500 */}
            <span style={S.rowLabel}>Account settings</span>
          </div>
          <ChevronRight size={16} color="#9ca3af" /> {/* text-gray-400 */}
        </button>

        {/* Dark mode — hover:bg-white/40 + toggle pill */}
        <button
          style={S.row}
          onClick={onToggleTheme}
          onMouseEnter={e => rowHover(e)}
          onMouseLeave={rowOut}
          onMouseDown={rowPress}
          onMouseUp={rowRelease}
        >
          <div style={S.rowLeft}>
            <Moon size={18} color="#f97316" />       {/* text-orange-500 */}
            <span style={S.rowLabel}>Dark mode</span>
          </div>

          {/* Toggle — w-10 h-5 bg-orange-500 rounded-full, knob translate-x-5 when on */}
          <div style={{
            width: 40, height: 20,                   // w-10 h-5
            borderRadius: 10,
            background: isDark ? '#f97316' : 'rgba(0,0,0,0.15)', // bg-orange-500
            display: 'flex', alignItems: 'center',
            padding: '0 2px',
            transition: 'background 0.22s',
            flexShrink: 0,
          }}>
            <div style={{
              width: 16, height: 16,                 // w-4 h-4
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)', // shadow-md
              transform: isDark ? 'translateX(20px)' : 'translateX(0)', // translate-x-5 = 20px
              transition: 'transform 0.22s',
            }} />
          </div>
        </button>

        {/* Logout — hover:bg-red-50 */}
        <button
          style={S.row}
          onClick={onLogout}
          onMouseEnter={e => rowHover(e, 'rgba(254,242,242,0.8)')} // hover:bg-red-50
          onMouseLeave={rowOut}
          onMouseDown={rowPress}
          onMouseUp={rowRelease}
        >
          <div style={{ ...S.rowLeft, color: '#ef4444' }}>
            <LogOut size={18} color="#ef4444" />
            <span style={{ ...S.rowLabel, color: '#ef4444' }}>Log out</span>
          </div>
          <ChevronRight size={16} color="#fca5a5" /> {/* text-red-300 */}
        </button>
      </div>

      {/* Pointer diamond — absolute bottom-[-8px] right-6 w-4 h-4 rotate-45 border-r border-b border-white/30 */}
      <div style={{ ...S.pointer, ...pointerStyle }}>
        <div style={S.pointerOuter}>
          <div style={S.pointerInner} />
        </div>
      </div>
    </motion.div>
  );
}
