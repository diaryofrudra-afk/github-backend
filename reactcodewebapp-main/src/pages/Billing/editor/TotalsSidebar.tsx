import { useState } from 'react';
import { fmtINR } from '../../../utils';

interface Props {
  subtotal: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  total: number;
  itemCount: number;
  discount: number;
  additionalCharges: number;
  summariseQty: boolean;
  onDiscountChange: (v: number) => void;
  onAdditionalChange: (v: number) => void;
  onSummariseChange: (v: boolean) => void;
}

export function TotalsSidebar({
  subtotal, totalGst, cgst, sgst, total, itemCount,
  discount, additionalCharges, summariseQty,
  onDiscountChange, onAdditionalChange, onSummariseChange,
}: Props) {
  const [showDiscount, setShowDiscount] = useState(discount > 0);
  const [showAdditional, setShowAdditional] = useState(additionalCharges > 0);

  const gstPct = subtotal > 0 ? Math.round((totalGst / subtotal) * 100) : 18;

  return (
    <div className="de-totals-card">
        <div className="de-totals-head">
          <h4>Totals</h4>
          <span className="meta">Review pricing before saving</span>
        </div>
        <div className="de-totals-tiles">
          <div className="de-tile">
            <div className="tk">Subtotal<br/>(before tax)</div>
            <div className="tv">{fmtINR(subtotal)}</div>
          </div>
          <div className="de-tile">
            <div className="tk">Total GST<br/>({gstPct}%)</div>
            <div className="tv">{fmtINR(totalGst)}</div>
          </div>
          <div className="de-tile total">
            <div className="tk">Total (INR)</div>
            <div className="tv">{fmtINR(total)}</div>
          </div>
        </div>
        <div className="de-totals-breakup">
          <div className="heading">Breakup of GST</div>
          <div className="row"><span>CGST ({gstPct / 2}%)</span><b>{fmtINR(cgst)}</b></div>
          <div className="row"><span>SGST ({gstPct / 2}%)</span><b>{fmtINR(sgst)}</b></div>
        </div>
        <div className="de-totals-actions">
          {showDiscount ? (
            <div>
              <label className="de-label">Discount (₹)</label>
              <input
                className="de-input"
                type="number"
                value={discount}
                onChange={e => onDiscountChange(Number(e.target.value) || 0)}
              />
            </div>
          ) : (
            <button className="de-ghost-btn" onClick={() => setShowDiscount(true)}>+ Add discount</button>
          )}
          {showAdditional ? (
            <div>
              <label className="de-label">Additional charges (₹)</label>
              <input
                className="de-input"
                type="number"
                value={additionalCharges}
                onChange={e => onAdditionalChange(Number(e.target.value) || 0)}
              />
            </div>
          ) : (
            <button className="de-ghost-btn" onClick={() => setShowAdditional(true)}>+ Add additional charges</button>
          )}
        </div>
        <label className="de-totals-checkbox">
          <input
            type="checkbox"
            checked={summariseQty}
            onChange={e => onSummariseChange(e.target.checked)}
          />
          Summarise total quantity ({itemCount})
        </label>
        <div className="de-totals-foot">Inclusive of all taxes</div>
      </div>
  );
}
