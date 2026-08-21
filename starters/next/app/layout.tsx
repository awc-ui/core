import type { ReactNode } from 'react';
// Global MD3 design tokens (--md-sys-*) that the components' shadow styles
// reference via var(). Must live in the document, not per shadow root.
import '@awc-ui/tokens/tokens.css';

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
