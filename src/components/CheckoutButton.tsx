'use client';

import { useState } from 'react';

interface CheckoutButtonProps {
  plan: 'monthly' | 'yearly';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CheckoutButton({ plan, className, style, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initialize checkout. Please try again.');
      }
    } catch {
      alert('Unable to connect to the checkout service. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      className={className} 
      onClick={handleCheckout} 
      disabled={loading}
      style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', ...style }}
    >
      {loading ? 'Processing...' : children}
    </button>
  );
}
