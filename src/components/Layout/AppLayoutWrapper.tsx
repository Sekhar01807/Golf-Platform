'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import { ToastProvider } from '@/components/Toast/Toast';

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardOrAdmin = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  return (
    <ToastProvider>
      {isDashboardOrAdmin ? (
        // Clean full-height workspace for Dashboard and Admin shells (No marketing navbar/footer)
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      ) : (
        // Public website with fixed navbar and marketing footer
        <>
          <Navbar />
          <div style={{ paddingTop: '72px', minHeight: 'calc(100vh - 72px)' }}>
            {children}
          </div>
          <Footer />
        </>
      )}
    </ToastProvider>
  );
}
