import type { ReactNode } from 'react';
// Global MD3 design tokens (--md-sys-*) that the components' shadow styles
// reference via var(). Must live in the document, not per shadow root.
import '@awc-ui/core/css/tokens.css';
import './globals.css';
import Shell from '../components/Shell';

export const metadata = {
  title: 'Relaymesh — API Observability Console',
  description:
    'Fleet health, latency, request logs and incident response for the Relaymesh API mesh.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
