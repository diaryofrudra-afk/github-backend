import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, History, Contact, User } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { ProfilePopup } from './ProfilePopup';

interface BottomNavProps {
  onSignOut: () => void;
}

const PAGE_TABS = [
  { id: 'logger',     label: 'Log Time',   Icon: ClipboardList },
  { id: 'op-history', label: 'History',    Icon: History },
  { id: 'attendance', label: 'Attendance', Icon: Contact },
] as const;

const ORB_STYLE = {
  position: 'absolute' as const,
  inset: 0,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #e8b96a, var(--accent))',
  boxShadow: '0 0 25px rgba(217,140,42,0.65)',
};

const LABEL_STYLE = {
  position: 'absolute' as const,
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  fontSize: '11px',
  fontWeight: 600,
  color: '#fff',
  background: 'rgba(0,0,0,0.6)',
  padding: '3px 8px',
  borderRadius: '6px',
  whiteSpace: 'nowrap' as const,
  pointerEvents: 'none' as const,
  backdropFilter: 'blur(8px)',
  marginBottom: '6px',
  zIndex: 10,
};

const TAB_BUTTON_STYLE = {
  position: 'relative' as const,
  width: 56,
  height: 56,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
  flexShrink: 0,
  userSelect: 'none' as const,
};

const ORB_TRANSITION = { type: 'spring', stiffness: 300, damping: 25 } as const;
const LABEL_INITIAL = { opacity: 0, y: 4 };
const LABEL_ANIMATE = { opacity: 1, y: -10 };
const LABEL_EXIT = { opacity: 0, y: 4 };
const POPUP_MARGIN = 16;
const POPUP_MAX_WIDTH = 600;

export function BottomNav({ onSignOut }: BottomNavProps) {
  const {
    activePage, setActivePage,
    theme, toggleTheme, setSettingsOpen,
    user, userRole, state,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const [pointerStyle, setPointerStyle] = useState<CSSProperties>({});
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);

  const isDark = theme === 'dark';

  // Operator profile lookup
  const operators = state?.operators || [];
  const currentOperator = userRole === 'operator'
    ? operators.find(op => op.phone === user || String(op.id) === user)
    : null;

  const profile =
    (user ? state.operatorProfiles[user] : null) ||
    (currentOperator?.id ? state.operatorProfiles[currentOperator.id] : null) ||
    (currentOperator?.phone ? state.operatorProfiles[currentOperator.phone] : null);

  const opName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : (currentOperator?.name || '');
  const opPhone = currentOperator?.phone || user || '';
  const opPhoto = profile?.photo || '';

  function getInitials(name: string): string {
    if (!name || name === '—') return 'OP';
    if (/^\+?\d+$/.test(name.replace(/\s/g, ''))) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const initials = getInitials(opName || user || '');

  // Attendance count for current month
  const attendance = state?.attendance || [];
  const operatorKeys = currentOperator
    ? [currentOperator.phone, String(currentOperator.id)].filter(Boolean)
    : [];
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let presentCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (attendance.find(a => operatorKeys.includes(a.operator_key) && a.date === iso && a.status === 'present')) {
      presentCount++;
    }
  }

  function handleDocuments() {
    setMenuOpen(false);
    setSettingsOpen(true);
  }

  function handleLogout() {
    setMenuOpen(false);
    onSignOut();
  }

  function syncPopupPosition() {
    const button = profileButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const popupWidth = Math.min(POPUP_MAX_WIDTH, window.innerWidth - POPUP_MARGIN * 2);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - popupWidth / 2, POPUP_MARGIN),
      window.innerWidth - popupWidth - POPUP_MARGIN,
    );
    const bottom = Math.max(16, window.innerHeight - rect.top + 16);
    const pointerLeft = Math.min(
      Math.max(rect.left + rect.width / 2 - left - 8, 24),
      popupWidth - 40,
    );

    setPopupStyle({
      left,
      right: 'auto',
      bottom,
      width: popupWidth,
    });
    setPointerStyle({
      left: pointerLeft,
      right: 'auto',
    });
  }

  useLayoutEffect(() => {
    if (!menuOpen) return;

    syncPopupPosition();

    const handle = () => syncPopupPosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [menuOpen]);

  return (
    <>
      {/* Dismiss layer */}
      {menuOpen && (
        <div className="bnp-dismiss" onClick={() => setMenuOpen(false)} />
      )}

      {/* Floating profile card */}
      <AnimatePresence>
        {menuOpen && (
          <ProfilePopup
            opName={opName}
            opPhone={opPhone}
            opPhoto={opPhoto}
            initials={initials}
            isDark={isDark}
            onSettings={handleDocuments}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
            positionStyle={popupStyle}
            pointerStyle={pointerStyle}
          />
        )}
      </AnimatePresence>

      <div id="bottom-nav-spacer" />

      <nav id="bottom-nav">
        <div
          className="bottom-nav-inner"
          style={{ padding: '8px 12px', gap: '16px', width: 'fit-content', margin: '0 auto' }}
        >
          {/* Page tabs */}
          {PAGE_TABS.map((tab) => {
            const isActive = !menuOpen && activePage === tab.id;
            return (
              <button
                key={tab.id}
                style={TAB_BUTTON_STYLE}
                onClick={() => { setMenuOpen(false); setActivePage(tab.id as never); }}
                aria-label={tab.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-orb"
                    style={ORB_STYLE}
                    transition={ORB_TRANSITION}
                  />
                )}

                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      key="lbl"
                      initial={LABEL_INITIAL}
                      animate={LABEL_ANIMATE}
                      exit={LABEL_EXIT}
                      style={LABEL_STYLE}
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                <motion.div
                  animate={{ scale: isActive ? 1.12 : 1 }}
                  transition={ORB_TRANSITION}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <tab.Icon
                    size={22}
                    color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'}
                  />
                </motion.div>

                {/* Pip dot */}
                <motion.div
                  animate={{
                    background: isActive ? '#D98C2A' : 'rgba(255,255,255,0.18)',
                    scale: isActive ? 1 : 0.7,
                  }}
                  transition={ORB_TRANSITION}
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    zIndex: 2,
                  }}
                />
              </button>
            );
          })}

          {/* Profile tab */}
          <button
            style={TAB_BUTTON_STYLE}
            ref={profileButtonRef}
            onClick={() => setMenuOpen(m => !m)}
            aria-label="Profile"
          >
            {menuOpen && (
              <motion.div
                layoutId="active-orb"
                style={ORB_STYLE}
                transition={ORB_TRANSITION}
              />
            )}

            <AnimatePresence>
              {menuOpen && (
                <motion.span
                  key="lbl"
                  initial={LABEL_INITIAL}
                  animate={LABEL_ANIMATE}
                  exit={LABEL_EXIT}
                  style={LABEL_STYLE}
                >
                  Profile
                </motion.span>
              )}
            </AnimatePresence>

            <motion.div
              animate={{ scale: menuOpen ? 1.12 : 1 }}
              transition={ORB_TRANSITION}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {opPhoto ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={opPhoto}
                    alt=""
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  {presentCount > 0 && (
                    <span className="bottom-nav-profile-count">{presentCount}</span>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <User size={22} color={menuOpen ? '#fff' : 'rgba(255,255,255,0.45)'} />
                  {presentCount > 0 && (
                    <span className="bottom-nav-profile-count">{presentCount}</span>
                  )}
                </div>
              )}
            </motion.div>

            {/* Pip dot */}
            <motion.div
              animate={{
                background: menuOpen ? '#D98C2A' : 'rgba(255,255,255,0.18)',
                scale: menuOpen ? 1 : 0.7,
              }}
              transition={ORB_TRANSITION}
              style={{
                position: 'absolute',
                bottom: 4,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 4,
                height: 4,
                borderRadius: '50%',
                zIndex: 2,
              }}
            />
          </button>
        </div>
      </nav>
    </>
  );
}
