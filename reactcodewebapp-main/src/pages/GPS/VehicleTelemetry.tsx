import type { UnifiedVehicle } from '../../hooks/useUnifiedGPS';

// ── Formatting helpers ────────────────────────────────────────────────────────
// All return `null` when the value is absent so empty fields can be skipped
// entirely (different TnT devices report different sensors).

function num(v: number | undefined | null, unit = '', digits?: number): string | null {
  if (v == null || typeof v !== 'number' || !isFinite(v)) return null;
  const shown = typeof digits === 'number' ? v.toFixed(digits) : v;
  return `${shown}${unit}`;
}

// Like num() but treats 0 as "no reading" (used for voltages / signal where the
// backend defaults to 0 when the device sends nothing).
function pos(v: number | undefined | null, unit = '', digits?: number): string | null {
  if (v == null || typeof v !== 'number' || v <= 0) return null;
  return num(v, unit, digits);
}

function str(v: string | undefined | null, skip: string[] = []): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (t === '' || skip.includes(t.toLowerCase())) return null;
  return t;
}

function cap(v: string | null): string | null {
  if (v == null) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function yesNo(v: boolean | undefined | null, yes = 'Yes', no = 'No'): string | null {
  if (v == null) return null;
  return v ? yes : no;
}

type Metric = { label: string; value: string };

// Build a metric list from [label, value|null] pairs, dropping the null ones.
function build(...entries: [string, string | null][]): Metric[] {
  return entries
    .filter((e): e is [string, string] => e[1] != null)
    .map(([label, value]) => ({ label, value }));
}

function Section({ title, metrics }: { title: string; metrics: Metric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="telemetry-section">
      <div className="telemetry-section-title">{title}</div>
      <div className="metrics-grid">
        {metrics.map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
// Renders every captured real-time field for the selected vehicle, grouped into
// sections. Each section only appears if it has at least one populated field, so
// the panel adapts to whatever the device actually reports (and stays mostly
// empty for non-TnT providers).

export function VehicleTelemetry({ vehicle: v }: { vehicle: UnifiedVehicle }) {
  const crane = build(
    ['Duty', num(v.sli_duty, ' %')],
    ['Boom Angle', num(v.sli_angle, '°')],
    ['Boom Radius', num(v.sli_radius, ' m')],
    ['Boom Length', num(v.sli_length, ' m')],
    ['Load on Hook', num(v.sli_load, ' T')],
    ['Safe Working Load', num(v.sli_swl, ' T')],
    ['Overload', num(v.sli_overload)],
  );

  const engine = build(
    ['Coolant Temp', num(v.j1939_coolant_temp, ' °C')],
    ['Oil Pressure', num(v.j1939_oil_pressure, ' psi')],
    ['Engine RPM', num(v.j1939_engine_speed, ' RPM')],
    ['Fuel Level', num(v.j1939_fuel_level, ' %')],
    ['Fuel Used', num(v.j1939_fuel_consumption, ' L')],
    ['Hour Meter', num(v.j1939_hour_meter, ' hrs')],
    ['Battery', num(v.j1939_battery_potential, ' V')],
    ['Trans Oil Temp', num(v.j1939_trans_oil_temp, ' °C')],
    ['Urea / DEF', num(v.j1939_urea_level, ' %')],
    ['Check Engine', yesNo(v.j1939_mil, 'On', 'Off')],
    ['Stop Lamp', yesNo(v.j1939_stop_indicator, 'On', 'Off')],
    ['Water in Fuel', yesNo(v.j1939_water_in_fuel)],
  );

  const movement = build(
    ['Speed', num(v.speed, ' km/h')],
    ['Status', cap(str(v.status, ['unknown']))],
    ['Distance Today', num(v.today_km, ' km')],
    ['Odometer', num(v.odometer, ' km')],
    ['Engine Hours', num(v.engine_hours, ' hrs')],
    ['Engine Hrs Today', num(v.today_engine_hours, ' hrs')],
    ['Idle Duration', str(v.idle_duration)],
    ['Stopped For', str(v.stop_duration)],
    ['Trip Distance', num(v.trip_distance, ' km')],
    ['Trip Avg Speed', num(v.trip_avg_speed, ' km/h')],
  );

  const sensors: Metric[] = [
    ...build(
      ['Temperature', num(v.temperature, ' °C')],
      ['Temperature 2', num(v.temperature2, ' °C')],
      ['Door', cap(str(v.door_status))],
      ['AC', cap(str(v.ac_status))],
      ['RPM', num(v.rpm, ' RPM')],
      ['SOS Button', str(v.sos_button)],
      ['Charging', str(v.battery_charge_status)],
    ),
    // Dynamic analog inputs (ain1–24) the device has labelled.
    ...(v.ain_sensors ?? [])
      .filter(s => s.label && s.value != null && String(s.value).trim() !== '')
      .map(s => ({
        label: s.label,
        value: `${s.value}${s.units ? ` ${s.units}` : ''}`,
      })),
  ];

  const fuel = build(
    ['Fuel', num(v.fuel_percentage, ' %')],
    ['Fuel (litres)', num(v.fuel_litres, ' L')],
  );

  const power = build(
    ['Main Voltage', pos(v.main_voltage, ' V')],
    ['Backup Voltage', pos(v.backup_voltage, ' V')],
    ['Battery', cap(str(v.battery_charge, ['unknown']))],
    ['Main Power Low', v.is_main_power_low ? 'Yes' : null],
  );

  const network = build(
    ['Network', cap(str(v.network_status, ['unknown']))],
    ['GSM Signal', pos(v.gsm_signal, '/31')],
    ['GPS Fix', v.is_gps_working == null ? null : v.is_gps_working ? 'OK' : 'No fix'],
    ['Satellites', num(v.gps_satellites)],
    ['HDOP', num(v.hdop)],
    ['Heading', num(v.heading, '°')],
    ['Altitude', num(v.altitude, ' m')],
  );

  const driver = build(
    ['Driver', str(v.driver_name)],
    ['Mobile', str(v.driver_mobile)],
  );

  const state = build(
    ['Immobilizer', cap(str(v.immobilizer))],
    ['Ignition On Since', str(v.ignition_on_since)],
    ['Ignition Off Since', str(v.ignition_off_since)],
    ['Parked Since', str(v.parked_since)],
    ['Last Update', str(v.last_updated)],
  );

  // Active alerts → highlighted badges (only the danger booleans).
  const alerts = ([
    ['Panic', v.is_panic],
    ['Towing', v.is_towing],
    ['Overspeeding', v.is_overspeeding],
    ['Harsh Braking', v.is_harsh_braking],
    ['Harsh Acceleration', v.is_harsh_acceleration],
  ] as [string, boolean | undefined][])
    .filter(([, on]) => on === true)
    .map(([label]) => label);

  const address = str(v.address);

  return (
    <div className="vehicle-telemetry">
      <Section title="Crane / SLI" metrics={crane} />
      <Section title="Engine (CAN / J1939)" metrics={engine} />
      <Section title="Movement & Distance" metrics={movement} />
      <Section title="Sensors" metrics={sensors} />
      <Section title="Fuel" metrics={fuel} />
      <Section title="Power & Device Health" metrics={power} />
      <Section title="Network & GPS" metrics={network} />

      {alerts.length > 0 && (
        <div className="telemetry-section">
          <div className="telemetry-section-title">Alerts</div>
          <div className="telemetry-alerts">
            {alerts.map(a => (
              <span className="telemetry-alert-badge" key={a}>{a}</span>
            ))}
          </div>
        </div>
      )}

      <Section title="Driver" metrics={driver} />
      <Section title="State & Timing" metrics={state} />

      {address && (
        <div className="telemetry-section">
          <div className="telemetry-section-title">Location</div>
          <div className="telemetry-address">{address}</div>
        </div>
      )}
    </div>
  );
}
