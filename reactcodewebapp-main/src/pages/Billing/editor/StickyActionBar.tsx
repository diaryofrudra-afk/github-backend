import { fmtINR } from '../../../utils';
import { EyeIcon, LockIcon } from './icons';

interface Props {
  revenue: number;
  utilization: number;
  activeFleet: string;
  saving: boolean;
  onPreview: () => void;
  onSave: () => void;
}

export function StickyActionBar({ revenue, utilization, activeFleet, saving, onPreview, onSave }: Props) {
  return (
    <div className="de-sticky-bar">
      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Revenue</div>
          <div className="val">{fmtINR(revenue)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Utilization</div>
          <div className="val">{utilization}%</div>
        </div>
        <div className="kpi">
          <div className="lbl">Active fleet</div>
          <div className="val">{activeFleet}</div>
        </div>
      </div>
      <div className="actions">
        <button className="de-btn" onClick={onPreview}><EyeIcon /> Preview</button>
        <button className="de-btn primary" onClick={onSave} disabled={saving}>
          <LockIcon /> Save & Close
        </button>
      </div>
    </div>
  );
}
