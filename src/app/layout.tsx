import type { Metadata } from 'next';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import { ToastProvider } from '@/components/Toast/Toast';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GolfCharity — Play Golf. Make An Impact.',
  description:
    'A premium golf platform combining Stableford score tracking, charitable giving, and monthly prize draws. Play your game, support verified causes, and win prizes.',
  keywords: ['golf', 'charity', 'subscription', 'prize draw', 'stableford', 'fundraising'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Navbar />
          <div style={{ paddingTop: '72px', minHeight: 'calc(100vh - 72px)' }}>
            {children}
          </div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
