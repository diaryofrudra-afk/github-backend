import React from 'react';
import { GSTVerification } from '../components/GSTVerification';
import type { GSTDetails } from '../types/gst';

interface Props {
  active: boolean;
}

export const GSTVerificationPage: React.FC<Props> = ({ active }) => {
  const handleGSTVerified = (gstin: string, details: GSTDetails) => {
    console.log('GST Verified:', gstin, details);
    // You can save this to your backend, update client state, etc.
  };

  if (!active) return null;

  return (
    <div className="page active">
      <div className="section-bar">
        <h2 className="section-title">GST Verification</h2>
      </div>
      <div className="chart-card" style={{ padding: '30px' }}>
        <GSTVerification onGSTVerified={handleGSTVerified} />
      </div>
    </div>
  );
};
