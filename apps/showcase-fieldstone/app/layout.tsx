import type { ReactNode } from 'react';
// Global MD3 design tokens (--md-sys-*) that the components' shadow styles
// reference via var(). Must live in the document, not per shadow root.
import '@awc-ui/core/css/tokens.css';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata = {
  title: 'Fieldstone Ops — Logistics admin console',
  description: 'Fictional logistics admin console built on AWC UI Material Design 3 web components.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Components expect Roboto + Material Symbols at the document level. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
