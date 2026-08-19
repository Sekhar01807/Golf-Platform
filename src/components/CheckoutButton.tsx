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
    try {
      setLoading(true);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initialize checkout');
      }
    } catch {
      alert('An error occurred during checkout');
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
