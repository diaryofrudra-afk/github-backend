import React, { useState } from 'react';
import { verifyGST } from '../services/gst';
import type { GSTDetails } from '../types/gst';

interface GSTVerificationProps {
  onGSTVerified?: (gstin: string, details: GSTDetails) => void;
  initialGSTIN?: string;
}

export const GSTVerification: React.FC<GSTVerificationProps> = ({
  onGSTVerified,
  initialGSTIN = ''
}) => {
  const [gstin, setGstin] = useState(initialGSTIN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gstDetails, setGstDetails] = useState<GSTDetails | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gstin.trim()) {
      setError('Please enter a GSTIN');
      return;
    }

    setLoading(true);
    setError(null);
    setGstDetails(null);

    try {
      const response = await verifyGST(gstin);

      if (response.success && response.data) {
        setGstDetails(response.data);
        onGSTVerified?.(gstin, response.data);
      } else {
        setError(response.error || response.message || 'Verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setGstin('');
    setGstDetails(null);
    setError(null);
  };

  return (
    <div className="gst-verification-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', color: 'var(--t1)' }}>GSTIN Verification</h2>

      {/* Input Form */}
      <form onSubmit={handleVerify} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="login-input"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="Enter 15-digit GSTIN"
            maxLength={15}
            style={{
              flex: 1,
              minWidth: '250px',
              margin: 0,
              textAlign: 'left',
              letterSpacing: '0.1em'
            }}
            disabled={loading}
          />
          <button
            type="submit"
            className="login-btn"
            disabled={loading || !gstin.trim()}
            style={{
              width: 'auto',
              padding: '0 25px',
              background: loading ? 'var(--bg5)' : 'var(--accent)',
              color: loading ? 'var(--t4)' : '#000'
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          {gstDetails && (
            <button
              type="button"
              className="login-btn"
              onClick={handleClear}
              style={{
                width: 'auto',
                padding: '0 25px',
                background: 'var(--red)',
                color: '#fff'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="warn-bar" style={{ marginBottom: '20px', display: 'flex' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--t2)'
        }}>
          <div className="spinner" style={{
            border: '4px solid var(--bg4)',
            borderTop: '4px solid var(--accent)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 10px'
          }} />
          <p>Verifying GSTIN... Please wait</p>
        </div>
      )}

      {/* GST Details Display */}
      {gstDetails && (
        <div className="crane-card" style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border2)',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: '1px solid var(--border)'
          }}>
            <h3 style={{ margin: 0, color: 'var(--t1)' }}>GST Details</h3>
            <span className={`op-pill ${gstDetails.gstin_status === 'Active' ? 'on' : 'off'}`}>
              <span className={`op-dot ${gstDetails.gstin_status === 'Active' ? 'pulse' : ''}`} />
              {gstDetails.gstin_status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <DetailItem label="GSTIN" value={gstDetails.gstin} />
            <DetailItem label="Legal Name" value={gstDetails.legal_name} />
            <DetailItem label="Trade Name" value={gstDetails.trade_name || 'N/A'} />
            <DetailItem label="Registration Date" value={formatDate(gstDetails.registration_date)} />
            <DetailItem label="Constitution" value={gstDetails.constitution_of_business} />
            <DetailItem label="Taxpayer Type" value={gstDetails.taxpayer_type} />
            <DetailItem label="Last Updated" value={formatDate(gstDetails.last_update_date)} />
            <DetailItem label="Center Jurisdiction" value={gstDetails.center_jurisdiction} />
            <DetailItem label="State Jurisdiction" value={gstDetails.state_jurisdiction} />
          </div>

          {/* Principal Place of Business */}
          {gstDetails.principal_place_of_business && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h4 className="section-title" style={{ marginBottom: '10px' }}>Principal Place of Business</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <DetailItem label="Address" value={gstDetails.principal_place_of_business.address} />
                <DetailItem label="City" value={gstDetails.principal_place_of_business.city} />
                <DetailItem label="State" value={gstDetails.principal_place_of_business.state} />
                <DetailItem label="Pincode" value={gstDetails.principal_place_of_business.pincode} />
              </div>
            </div>
          )}

          {/* Nature of Business Activities */}
          {gstDetails.nature_of_business_activities && gstDetails.nature_of_business_activities.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h4 className="section-title" style={{ marginBottom: '10px' }}>Nature of Business Activities</h4>
              <div className="badges" style={{ justifyContent: 'flex-start' }}>
                {gstDetails.nature_of_business_activities.map((activity, index) => (
                  <span key={index} className="badge accent">
                    {activity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional Places of Business */}
          {gstDetails.additional_places_of_business && gstDetails.additional_places_of_business.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h4 className="section-title" style={{ marginBottom: '10px' }}>Additional Places of Business ({gstDetails.additional_places_of_business.length})</h4>
              {gstDetails.additional_places_of_business.map((place, index) => (
                <div key={index} style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg4)',
                  borderRadius: 'var(--r)',
                  marginBottom: '10px',
                  border: '1px solid var(--border)'
                }}>
                  <p style={{ margin: '5px 0', color: 'var(--t1)', fontSize: '13px' }}><strong>Address:</strong> {place.address}</p>
                  <p style={{ margin: '5px 0', color: 'var(--t2)', fontSize: '12px' }}><strong>City:</strong> {place.city} | <strong>State:</strong> {place.state} | <strong>PIN:</strong> {place.pincode}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filing Status */}
          {gstDetails.filing_status && gstDetails.filing_status.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h4 className="section-title" style={{ marginBottom: '10px' }}>Recent Filing Status</h4>
              <div className="sh-table">
                <div className="sh-head">
                  <div className="sh-hl">Return Type</div>
                  <div className="sh-hl">Tax Period</div>
                  <div className="sh-hl">Filing Date</div>
                  <div className="sh-hl" style={{ textAlign: 'right' }}>Status</div>
                </div>
                {gstDetails.filing_status.slice(0, 5).map((filing, index) => (
                  <div key={index} className="sh-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <div className="sh-date">{filing.return_type}</div>
                    <div className="sh-time">{filing.tax_period}</div>
                    <div className="sh-time">{formatDate(filing.date_of_filing)}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${filing.status === 'Filed' ? 'green' : 'amber'}`}>
                        {filing.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Helper Components
const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--t1)', wordBreak: 'break-word' }}>{value || '—'}</div>
  </div>
);

// Helper Functions
function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export default GSTVerification;
