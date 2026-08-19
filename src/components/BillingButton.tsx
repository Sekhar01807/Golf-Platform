'use client';

import { useState } from 'react';

export default function BillingButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  const handleBilling = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing', { method: 'POST' });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
      }
    } catch {
      alert('Failed to connect to billing server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      className={className} 
      onClick={handleBilling} 
      disabled={loading}
      style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {loading ? 'Please Wait...' : children}
    </button>
  );
}
