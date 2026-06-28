// Shared notification helpers — used by the GPS page dropdown and the global
// mobile header notification sheet. Keep the message-parsing in one place so both
// surfaces render identical, rich cards from the same plain-text backend rows.

export interface NotificationRow {
  id: string;
  message: string;
  type: string;
  timestamp: string;
  read: number;
}

export type NotificationIconType =
  | 'engine-on'
  | 'engine-off'
  | 'doc-expiry'
  | 'doc-warning'
  | 'logbook'
  | 'general-info';

export interface ParsedNotification {
  id: string;
  originalMessage: string;
  type: string;
  timestamp: string;
  read: boolean;
  title: string;
  subtitle: string;
  craneReg?: string;
  address?: string;
  iconType: NotificationIconType;
}

// High-fidelity parser that dissects plain text notifications into rich objects.
export function parseNotification(notif: NotificationRow): ParsedNotification {
  const msg = notif.message || '';
  let title = 'System Update';
  let subtitle = msg;
  let iconType: NotificationIconType = 'general-info';
  let craneReg = '';
  let address = '';

  if (msg.includes('engine turned')) {
    const isOff = msg.includes('OFF') || msg.includes('🔴');
    const parts = msg.split('engine turned');
    // Strip emojis and get the crane registration
    const regPart = parts[0]?.replace(/🟢|🔴|\s/g, '')?.trim() || 'Vehicle';
    craneReg = regPart;

    const remaining = parts[1] || '';
    if (remaining.includes('—')) {
      const subParts = remaining.split('—');
      address = subParts.slice(1).join('—').trim();
    }

    title = isOff ? 'Engine Stopped' : 'Engine Started';
    iconType = isOff ? 'engine-off' : 'engine-on';
    subtitle = isOff ? `Ignition turned OFF` : `Ignition turned ON`;
  } else if (msg.includes('logged') && /hrs?\s+on/i.test(msg)) {
    // E.g., "📋 Ramesh Sahoo logged 9.2 hrs on OD02CR4471"
    const cleanMsg = msg.replace(/📋|🟢|🔴|⚠️/g, '').trim();
    const match = cleanMsg.match(/^(.*?)\s+logged\s+(.*?)\s+hrs?\s+on\s+(.*)$/i);
    if (match) {
      const operator = match[1].trim();
      const hours = match[2].trim();
      craneReg = match[3].trim();
      title = 'Logbook Entry';
      subtitle = `${operator} logged ${hours} hrs`;
    } else {
      title = 'Logbook Entry';
    }
    iconType = 'logbook';
  } else if (msg.includes('expired on')) {
    const cleanMsg = msg.replace(/🔴|⚠️/g, '').trim();
    // E.g., "MH12AB1234 Insurance expired on 2026-06-25"
    const match = cleanMsg.match(/^([A-Z0-9\-\s]+)\s+(.*?)\s+expired\s+on\s+(.*)$/i);
    if (match) {
      craneReg = match[1].trim();
      const docType = match[2].trim();
      const date = match[3].trim();
      title = `${docType} Expired`;
      subtitle = `Document expired alert`;
      address = `Expired on ${date}`;
    } else {
      title = 'Document Expired';
    }
    iconType = 'doc-expiry';
  } else if (msg.includes('expires in')) {
    const cleanMsg = msg.replace(/🔴|⚠️/g, '').trim();
    // E.g., "MH12AB1234 Fitness expires in 10 days (2026-07-05)"
    const match = cleanMsg.match(/^([A-Z0-9\-\s]+)\s+(.*?)\s+expires\s+in\s+(.*?)\s*\((.*?)\)$/i);
    if (match) {
      craneReg = match[1].trim();
      const docType = match[2].trim();
      const duration = match[3].trim();
      const date = match[4].trim();
      title = `${docType} Expiring`;
      subtitle = `Renewal required soon`;
      address = `Expires in ${duration} (${date})`;
    } else {
      title = 'Document Expiring';
    }
    iconType = 'doc-warning';
  } else {
    // Check type of notification as fallback
    if (notif.type === 'error') {
      iconType = 'doc-expiry';
      title = 'Alert';
    } else if (notif.type === 'warning') {
      iconType = 'doc-warning';
      title = 'Warning';
    } else if (notif.type === 'success') {
      iconType = 'engine-on';
      title = 'Success';
    }
  }

  return {
    id: notif.id,
    originalMessage: msg,
    type: notif.type,
    timestamp: notif.timestamp,
    read: notif.read === 1,
    title,
    subtitle,
    craneReg: craneReg || undefined,
    address: address || undefined,
    iconType,
  };
}

export function getRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();

    if (diffMs < 0 || isNaN(diffMs)) {
      return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
