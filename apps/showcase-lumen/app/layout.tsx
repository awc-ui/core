import type { ReactNode } from 'react';
// Global MD3 design tokens (--md-sys-*) that the components' shadow styles
// reference via var(). Must live in the document, not per shadow root.
import '@awc-ui/core/css/tokens.css';
import './globals.css';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Lumen Bank',
  description: 'Retail banking showcase built with AWC UI Material Design 3 web components.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Components expect Roboto and Material Symbols at document level. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
