import type { ReactNode } from 'react';
// Core's global tokens and unfinished-component guard load in the root layout.
import '@awc-ui/core/css/tokens.css';

export const metadata = {
  title: 'AWC UI Starter — Next.js',
  description: 'Mini dashboard built with server-rendered Material Design 3 web components.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: 'var(--md-sys-color-background)',
          color: 'var(--md-sys-color-on-background)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
