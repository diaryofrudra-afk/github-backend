import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Camera,
  CircleDollarSign,
  FileText,
  Fuel,
  LogOut,
  Menu,
  MonitorCog,
  Moon,
  ReceiptText,
  ShieldCheck,
  Sun,
  Truck,
  UserCog,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import type { NotificationRow } from '../../utils/notifications';
import type { PageId } from '../../types';
import './mobile-shell.css';

interface MobileOwnerShellProps {
  activePage: PageId;
  children: ReactNode;
  onOpenSettings: () => void;
  onPageChange: (page: PageId) => void;
  onSignOut: () => void;
}

interface OwnerNavItem {
  icon: LucideIcon;
  label: string;
  page: PageId;
}

interface OwnerActionItem {
  icon: LucideIcon;
  label: string;
  page?: PageId;
  tone?: 'default' | 'danger';
  onSelect?: () => void;
}

const PRIMARY_TABS: OwnerNavItem[] = [
  { page: 'fleet', label: 'Fleet', icon: Truck },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'billing', label: 'Billing', icon: ReceiptText },
  { page: 'gps', label: 'GPS', icon: MonitorCog },
];

const MORE_PAGES = new Set<PageId>([
  'operators',
  'earnings',
  'attendance',
  'clients',
  'fuel',
  'cameras',
  'diagnostics',
  'gst-verification',
]);

const PAGE_NAMES: Record<PageId, string> = {
  fleet: 'Fleet',
  operators: 'Operators',
  earnings: 'Earnings',
  attendance: 'Attendance',
  analytics: 'Analytics',
  billing: 'Billing',
  clients: 'Clients',
  gps: 'GPS',
  fuel: 'Fuel',
  cameras: 'Cameras',
  diagnostics: 'Diagnostics',
  'gst-verification': 'GST Verification',
  logger: 'Logger',
  'op-history': 'History',
  'op-attendance': 'Attendance',
  'engine-status': 'Engine Status',
};

export function MobileOwnerShell({
  activePage,
  children,
  onOpenSettings,
  onPageChange,
  onSignOut,
}: MobileOwnerShellProps) {
  const { theme, toggleTheme, state } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    setMoreOpen(false);
    setNotifOpen(false);
  }, [activePage]);

  // Resolve the owner's user_key once, then poll the same notification feed the
  // GPS page uses (engine ON/OFF, document expiry, logbook submissions).
  useEffect(() => {
    let cancelled = false;
    api.me().then((me) => { if (!cancelled) setUserKey(me.user_id); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await api.getNotifications(userKey);
        if (!cancelled) {
          const normalized: NotificationRow[] = rows.map((n) => ({
            id: n.id,
            message: n.message,
            type: n.type,
            timestamp: n.timestamp,
            read: typeof n.read === 'number' ? n.read : n.read ? 1 : 0,
          }));
          normalized.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          setNotifications(normalized);
        }
      } catch { /* will retry on next tick */ }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [userKey]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
    try { await api.markNotificationRead(id); } catch { /* re-syncs on next poll */ }
  };

  const handleClearAll = userKey
    ? async () => {
        try { await api.clearNotifications(userKey); setNotifications([]); } catch { /* noop */ }
      }
    : undefined;

  const unread = notifications.filter((n) => !n.read).length;
  const ownerName = state.ownerProfile?.name || '';
  const ownerPhoto = state.ownerProfile?.photo || '';
  const avatarInitials = ownerName
    ? ownerName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'OW';


  const sheetSections = useMemo<Array<{ label: string; items: OwnerActionItem[] }>>(
    () => [
      {
        label: 'Manage',
        items: [
          { icon: UserCog, label: 'Operators', page: 'operators' },
          { icon: CircleDollarSign, label: 'Earnings', page: 'earnings' },
          { icon: Activity, label: 'Attendance', page: 'attendance' },
          { icon: Building2, label: 'Clients', page: 'clients' },
        ],
      },
      {
        label: 'Infrastructure',
        items: [
          { icon: Fuel, label: 'Fuel', page: 'fuel' },
          { icon: Camera, label: 'Cameras', page: 'cameras' },
          { icon: FileText, label: 'Documents', page: 'diagnostics' },
          { icon: ShieldCheck, label: 'GST Verification', page: 'gst-verification' },
        ],
      },
      {
        label: 'System',
        items: [
          { icon: LogOut, label: 'Sign Out', tone: 'danger', onSelect: onSignOut },
        ],
      },
    ],
    [onSignOut]
  );

  const isMoreActive = MORE_PAGES.has(activePage);
  function handleMoreSelect(item: OwnerActionItem) {
    if (item.page) {
      onPageChange(item.page);
      setMoreOpen(false);
      return;
    }
    item.onSelect?.();
    setMoreOpen(false);
  }

  return (
    <div className="mobile-shell mobile-owner-shell">
      <header className="mobile-app-topbar mobile-app-header">
        <div className="mobile-app-brand">
          <div className="mobile-app-brand-badge">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
              <path d="M3 17V7l8-3 10 4v9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 4v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="7" cy="19" r="2" fill="#fff" />
              <circle cx="16" cy="19" r="2" fill="#fff" />
            </svg>
          </div>
          <div className="mobile-app-brand-copy">
            <div className="mobile-app-brand-title">{PAGE_NAMES[activePage] || 'Suprwise'}</div>
          </div>
        </div>

        <div className="mobile-app-actions">
          <button
            aria-label="Toggle theme"
            className="mobile-app-icon-button"
            onClick={toggleTheme}
            type="button"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            className={`mobile-app-icon-button mobile-app-bell${notifOpen ? ' active' : ''}`}
            onClick={() => setNotifOpen((o) => !o)}
            type="button"
          >
            <Bell size={19} />
            {unread > 0 && <span className="mobile-app-bell-badge" />}
          </button>
          <button
            aria-label="Open settings"
            className="mobile-app-avatar"
            onClick={onOpenSettings}
            type="button"
          >
            {ownerPhoto ? <img src={ownerPhoto} alt={ownerName || 'Profile'} /> : avatarInitials}
          </button>
        </div>
      </header>

      {notifOpen && (
        <NotificationsPanel
          variant="sheet"
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
          onMarkRead={handleMarkRead}
          onClearAll={handleClearAll}
        />
      )}

      <main className="page-content mobile-shell-content">
        {children}
      </main>

      <nav className="mobile-tabbar" aria-label="Primary navigation">
        <div className="mobile-tabbar-inner">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activePage === tab.page;

            return (
              <button
                key={tab.page}
                aria-label={tab.label}
                className={`mobile-tabbar-button${isActive ? ' active' : ''}`}
                onClick={() => onPageChange(tab.page)}
                type="button"
              >
                <span className="mobile-tabbar-icon">
                  <Icon size={18} />
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            aria-label="More sections"
            className={`mobile-tabbar-button${isMoreActive || moreOpen ? ' active' : ''}`}
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <span className="mobile-tabbar-icon">
              <Menu size={18} />
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <button
            aria-label="Close more menu"
            className="mobile-more-overlay"
            onClick={() => setMoreOpen(false)}
            type="button"
          />
          <section className="mobile-more-sheet" aria-label="More sections">
            <div className="mobile-more-handle" />
            <div className="mobile-more-head">
              <div>
                <div className="mobile-more-title">More</div>
                <div className="mobile-more-subtitle">Every owner workflow stays one tap away.</div>
              </div>
              <button
                aria-label="Close more menu"
                className="mobile-app-icon-button"
                onClick={() => setMoreOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {sheetSections.map((section) => (
              <div className="mobile-more-section" key={section.label}>
                <div className="mobile-more-label">{section.label}</div>
                <div className="mobile-more-list">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.page === activePage;
                    return (
                      <button
                        className={`mobile-more-item${isActive ? ' active' : ''}${item.tone === 'danger' ? ' danger' : ''}`}
                        key={item.label}
                        onClick={() => handleMoreSelect(item)}
                        type="button"
                      >
                        <span className="mobile-more-item-icon">
                          <Icon size={18} />
                        </span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
