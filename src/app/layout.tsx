import type { Metadata } from 'next';
import AppLayoutWrapper from '@/components/Layout/AppLayoutWrapper';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GolfCharity — Play Golf. Make An Impact.',
  description:
    'A premium golf platform combining Stableford score tracking, charitable giving, and monthly prize draws. Play your game, support verified causes, and win prizes.',
  keywords: ['golf', 'charity', 'subscription', 'prize draw', 'stableford', 'fundraising'],
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppLayoutWrapper>
          {children}
        </AppLayoutWrapper>
      </body>
    </html>
  );
}
