
import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';
import type { Crane } from '../../types';
import { Edit2, Trash2, MapPin, User, Info, Clock } from 'lucide-react';

interface VehicleCardProps {
  crane: Crane;
  operatorName?: string;
  alerts: string[];
  gpsMatch?: UnifiedVehicle;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onViewLogbook: (reg: string, opKey: string) => void;
  onLiveTrack: (crane: Crane, gpsMatch?: UnifiedVehicle) => void;
}

export function VehicleCard({
  crane,
  operatorName,
  alerts,
  gpsMatch,
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
  
  // Fuel computation (live value if available, else deterministic mock based on ID)
  const getFuel = () => {
    if (gpsMatch?.fuel_percentage !== undefined && gpsMatch?.fuel_percentage !== null) {
      return Math.round(Number(gpsMatch.fuel_percentage));
    }
    if (gpsMatch?.j1939_fuel_level !== undefined && gpsMatch?.j1939_fuel_level !== null) {
      return Math.round(Number(gpsMatch.j1939_fuel_level));
    }
    // Deterministic fallback based on ID hash
    let hash = 0;
    const str = crane.id || crane.reg || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 80) + 15; // 15% to 95%
  };
  const fuel = getFuel();
  
  // Fuel style colors
  const fc = fuel <= 15 ? 'c' : fuel <= 35 ? 'l' : fuel <= 65 ? 'm' : 'g';
  const fuelBarColor = fc === 'c' ? '#EF4444' : fc === 'l' ? '#F59E0B' : fc === 'm' ? '#3B82F6' : '#22C55E';
  const fuelTextColor = fc === 'c' ? '#DC2626' : fc === 'l' ? '#D97706' : fc === 'm' ? '#2563EB' : '#16A34A';

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

  // Formatting label specifications
  const normalizedMake = crane.make && crane.make.toLowerCase().includes('wheelseye') ? 'Trak N Tell' : crane.make;
  const specsLine = [crane.year, normalizedMake, crane.capacity ? `${crane.capacity}T` : ''].filter(Boolean).join(' · ');
  const displayMake = (crane.make || '').toLowerCase().includes('wheelseye') ? 'Trak N Tell' : (crane.make || 'Blackbuck GPS');
  const trackerTypeLabel = (gpsMatch?.provider ? (gpsMatch.provider === 'blackbuck' ? 'Blackbuck GPS' : 'Trak N Tell') : displayMake) + ' · ' + typeLabel;

  // Visual borders / accent bars
  const cardBorderColorClass = isAlert ? 'border-red-200' : engineOn ? 'border-green-200' : 'border-slate-200';
  const topAccentColor = isAlert ? '#EF4444' : engineOn ? '#22C55E' : '#E2E8F0';
  const imgAreaBg = isCrane ? '#FFF7ED' : '#EEF2FF';

  return (
    <article className={`bg-white rounded-xl border ${cardBorderColorClass} overflow-hidden flex flex-col transition-all duration-200 hover:shadow-[0_6px_22px_rgba(15,23,42,0.09)] hover:-translate-y-0.5 group`}>
      <div className="flex">
        {/* Left: vector illustration box */}
        <div 
          className="w-40 flex-shrink-0 relative flex items-center justify-center overflow-hidden min-h-[160px]"
          style={{ background: imgAreaBg }}
        >
          {/* Accent top stripe */}
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: topAccentColor }} />

          {/* Inline Vector Crane SVG */}
          {isCrane ? (
            <svg fill="none" height="94" viewBox="0 0 116 94" width="116">
              <rect fill="#E2E8F0" height="2" rx="1" width="116" x="0" y="84" />
              <rect fill="#CBD5E1" height="34" rx="3" width="40" x="10" y="53" />
              <rect fill="#94A3B8" height="22" rx="3" width="25" x="15" y="40" />
              <rect fill="#BAE6FD" height="8" opacity="0.85" rx="1.5" width="8" x="18" y="43" />
              <rect fill="#BAE6FD" height="8" opacity="0.85" rx="1.5" width="8" x="28" y="43" />
              <line stroke="#F97316" strokeLinecap="round" strokeWidth="5.5" x1="27" x2="108" y1="40" y2="5" />
              <line opacity="0.55" stroke="#FED7AA" strokeLinecap="round" strokeWidth="2.5" x1="30" x2="111" y1="45" y2="10" />
              <line stroke="#FB923C" strokeLinecap="round" strokeWidth="4.5" x1="27" x2="4" y1="40" y2="51" />
              <rect fill="#EA580C" height="16" rx="2.5" width="12" x="0" y="45" />
              <line stroke="#94A3B8" strokeDasharray="4,3" strokeWidth="1.5" x1="93" x2="93" y1="12" y2="66" />
              <path d="M89 66 Q93 73 97 66" fill="none" stroke="#64748B" strokeLinecap="round" strokeWidth="2.5" />
              <circle cx="19" cy="86" fill="#334155" r="7" />
              <circle cx="19" cy="86" fill="#64748B" r="3.5" />
              <circle cx="36" cy="86" fill="#334155" r="7" />
              <circle cx="36" cy="86" fill="#64748B" r="3.5" />
              <circle cx="50" cy="86" fill="#334155" r="7" />
              <circle cx="50" cy="86" fill="#64748B" r="3.5" />
            </svg>
          ) : (
            // Inline Vector Truck/Machinery SVG
            <svg fill="none" height="80" viewBox="0 0 126 80" width="116">
              <rect fill="#E2E8F0" height="2" rx="1" width="126" x="0" y="70" />
              <rect fill="#E2E8F0" height="48" rx="3" width="74" x="2" y="20" />
              <line stroke="#CBD5E1" strokeWidth="1.5" x1="27" x2="27" y1="20" y2="68" />
              <line stroke="#CBD5E1" strokeWidth="1.5" x1="52" x2="52" y1="20" y2="68" />
              <rect fill="#CBD5E1" height="57" rx="5" width="55" x="68" y="11" />
              <rect fill="#93C5FD" height="28" opacity="0.75" rx="3" width="40" x="74" y="15" />
              <rect fill="#94A3B8" height="22" rx="2.5" width="10" x="116" y="37" />
              <rect fill="#FEF08A" height="7" rx="1.5" width="6" x="118" y="17" />
              <rect fill="#FCA5A5" height="5" rx="1" width="6" x="118" y="26" />
              <rect fill="#94A3B8" height="16" rx="2" width="5" x="76" y="3" />
              <circle cx="18" cy="72" fill="#1E293B" r="9" />
              <circle cx="18" cy="72" fill="#475569" r="4.5" />
              <circle cx="53" cy="72" fill="#1E293B" r="9" />
              <circle cx="53" cy="72" fill="#475569" r="4.5" />
              <circle cx="86" cy="72" fill="#1E293B" r="9" />
              <circle cx="86" cy="72" fill="#475569" r="4.5" />
              <circle cx="107" cy="72" fill="#1E293B" r="9" />
              <circle cx="107" cy="72" fill="#475569" r="4.5" />
            </svg>
          )}

          {/* Engine Status Badge Overlay */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-white rounded-full py-0.5 px-2 shadow-[0_1px_6px_rgba(15,23,42,0.12)]">
            <div className={`w-1.5 h-1.5 rounded-full ${engineOn ? 'bg-green-600 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
              {engineOn ? 'Engine Active' : 'Engine Off'}
            </span>
          </div>
        </div>

        {/* Right: metadata content area */}
        <div className="flex-1 p-3.5 flex flex-col gap-2 min-w-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: isCrane ? '#EA580C' : '#4F46E5', backgroundColor: isCrane ? '#FFF7ED' : '#EEF2FF' }}>
                {typeLabel}
              </span>
              {isAlert && (
                <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-red-600 bg-red-50 border border-red-100">
                  <Info size={10} /> Alert
                </span>
              )}
            </div>
            {/* Edit / Delete actions shown on hover */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button 
                onClick={() => onEdit(crane.id)} 
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Edit Asset"
              >
                <Edit2 size={13} />
              </button>
              <button 
                onClick={() => onDelete(crane.id)} 
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Delete Asset"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[17px] font-extrabold text-slate-900 leading-snug truncate" title={crane.reg}>
              {crane.reg}
            </h3>
            {specsLine && (
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                {specsLine}
              </p>
            )}
            <p className="text-[11px] text-slate-400 truncate">
              {trackerTypeLabel}
            </p>
          </div>

          {/* Fuel status bar indicator */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <svg fill="none" height="12" viewBox="0 0 13 15" width="11" stroke={fuelTextColor} strokeWidth="1.3">
                  <rect height="13" rx="1.5" width="8" x="1" y="1" />
                  <path d="M9 4.5l2.5 1.5v5a1 1 0 0 1-1 1H9" strokeWidth="1.2" />
                  <rect fill={fuelBarColor} height="4" opacity="0.45" rx="0.5" width="5" x="2.5" y="3" />
                </svg>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wide">
                  Fuel
                </span>
              </div>
              <span className="text-[12.5px] font-black" style={{ color: fuelTextColor }}>
                {fuel}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${fuel}%`, backgroundColor: fuelBarColor }}
              />
            </div>
          </div>

          {/* Location + Last updated info */}
          <div className="flex items-center gap-1 text-slate-500 min-w-0">
            <MapPin size={11} className="text-slate-400 flex-shrink-0" />
            <span className="text-[11.5px] font-semibold text-slate-600 truncate max-w-[120px]">
              {location}
            </span>
            <span className="text-slate-300 text-[10px] flex-shrink-0">•</span>
            <Clock size={11} className="text-slate-400 flex-shrink-0" />
            <span className="text-[11px] text-slate-400 truncate whitespace-nowrap">
              {lastSeen}
            </span>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="border-t border-slate-100 py-2 px-3.5 flex items-center justify-between bg-slate-50/50">
        {/* Operator status */}
        <div className="flex items-center">
          {op ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-[10.5px] font-black text-white flex-shrink-0 shadow-sm shadow-orange-200">
                {initials}
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                  Operator
                </p>
                <p className="text-[12.5px] font-black text-slate-800 leading-none">
                  {operatorName || op}
                </p>
              </div>
              <button 
                onClick={() => onAssign(crane.id)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-md transition duration-150 ml-1.5 shadow-sm"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
                <User size={13} className="text-slate-400" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                  Operator
                </p>
                <p className="text-[12px] font-semibold text-slate-400 leading-none">
                  Unassigned
                </p>
              </div>
              <button 
                onClick={() => onAssign(crane.id)}
                className="text-[11px] font-extrabold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/70 border border-orange-100 hover:border-orange-200 px-2 py-1 rounded-md transition duration-150 ml-1.5 shadow-sm"
              >
                Assign
              </button>
            </div>
          )}
        </div>

        {/* Action triggers */}
        <div className="flex gap-1.5">
          <button 
            onClick={() => onViewLogbook(crane.reg, crane.operator || '')} 
            className="inline-flex items-center gap-1 px-3 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold text-[12px] transition duration-150 active:scale-95 shadow-sm"
          >
            <Clock size={12} className="text-slate-400" />
            Logbook
          </button>
          <button 
            onClick={() => onLiveTrack(crane, gpsMatch)}
            className="inline-flex items-center gap-1 px-3 h-8 bg-slate-900 border border-slate-900 hover:bg-slate-800 hover:border-slate-800 rounded-lg text-white font-bold text-[12px] transition duration-150 active:scale-95 shadow-sm"
          >
            <MapPin size={12} className="text-slate-300" />
            Live Track
          </button>
        </div>
      </div>
    </article>
  );
}
