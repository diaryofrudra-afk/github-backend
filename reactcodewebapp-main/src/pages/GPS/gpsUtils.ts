import L from 'leaflet';

export function speedColor(speed: number): string {
  if (speed >= 40) return 'var(--green)';
  if (speed >= 10) return 'var(--amber)';
  return 'var(--red)';
}

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function makeTruckIcon(deg: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${deg}deg);
      filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));
    ">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="var(--accent)" stroke="#fff" stroke-width="2.5"/>
        <polygon points="16,6 21,22 16,18 11,22" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export const START_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:var(--green);border:3px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const END_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:var(--red);border:3px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
