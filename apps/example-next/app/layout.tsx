import type { ReactNode } from 'react';
// Global MD3 design tokens (--md-sys-*) that the components' shadow styles
// reference via var(). Must live in the document, not per shadow root.
import '@awc-ui/core/css/tokens.css';

export const metadata = {
  title: 'AWC UI × Next.js — SSR',
  description: 'Server-side rendered Material Design 3 web components.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
