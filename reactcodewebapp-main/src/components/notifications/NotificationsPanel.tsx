import {
  parseNotification,
  getRelativeTime,
  type NotificationRow,
  type NotificationIconType,
} from '../../utils/notifications';
import './notifications-panel.css';

interface NotificationsPanelProps {
  notifications: NotificationRow[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onClearAll?: () => void;
  /** 'dropdown' = anchored popover (GPS desktop); 'sheet' = fixed full-width (mobile). */
  variant?: 'dropdown' | 'sheet';
}

function NotificationIcon({ iconType }: { iconType: NotificationIconType }) {
  switch (iconType) {
    case 'engine-on':
    case 'engine-off':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
      );
    case 'doc-expiry':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'doc-warning':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'logbook':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 13l2 2 4-4" />
        </svg>
      );
    case 'general-info':
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

export function NotificationsPanel({
  notifications,
  onClose,
  onMarkRead,
  onClearAll,
  variant = 'dropdown',
}: NotificationsPanelProps) {
  const containerClass = variant === 'sheet' ? 'notif-panel-sheet' : 'notif-dropdown-overhaul';

  return (
    <>
      <div className="notif-backdrop" onClick={onClose} />
      <div className={containerClass}>
        <div className="notif-header">
          <div className="notif-header-title">
            <h3>Notifications</h3>
          </div>
          <div className="notif-header-actions">
            {onClearAll && notifications.length > 0 && (
              <button className="notif-action-link danger" onClick={onClearAll}>
                Clear all
              </button>
            )}
            {variant === 'sheet' && (
              <button className="notif-action-link" onClick={onClose} aria-label="Close notifications">
                Done
              </button>
            )}
          </div>
        </div>

        <div className="notif-list-overhaul">
          {notifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="notif-empty-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              </div>
              <h4>All Caught Up</h4>
              <p>No notifications for your fleet at this time.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const parsed = parseNotification(n);
              return (
                <div
                  key={parsed.id}
                  className={`notif-card-item ${parsed.read ? 'read' : 'unread'} type-${parsed.type}`}
                  onClick={() => !parsed.read && onMarkRead(parsed.id)}
                >
                  <div className={`notif-card-icon-container ${parsed.iconType}`}>
                    <NotificationIcon iconType={parsed.iconType} />
                  </div>
                  <div className="notif-card-content">
                    <div className="notif-card-header-row">
                      <span className="notif-card-title">{parsed.title}</span>
                      {!parsed.read && <span className="notif-card-unread-indicator" />}
                    </div>

                    {parsed.craneReg && (
                      <div className="notif-card-meta">
                        <span className="notif-plate-badge">{parsed.craneReg}</span>
                      </div>
                    )}

                    <div className="notif-card-msg">
                      {parsed.address ? (
                        <div className="notif-address-text">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3, verticalAlign: 'middle', display: 'inline-block' }}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {parsed.address}
                        </div>
                      ) : (
                        parsed.subtitle
                      )}
                    </div>

                    <div className="notif-card-footer">
                      <span className="notif-card-time">{getRelativeTime(parsed.timestamp)}</span>
                      {!parsed.read && (
                        <button
                          className="notif-card-read-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(parsed.id);
                          }}
                          title="Mark as read"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
