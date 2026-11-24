'use client';

// Dark mode: data-theme="dark" on <html> swaps the token palette.
import { MdSwitch } from '@awc-ui/react';

export function ThemeSwitch() {
  return (
    <MdSwitch
      slot="trailing"
      aria-label="Dark mode"
      // Reserve the default switch box while this client component loads.
      style={{ display: 'inline-flex', inlineSize: '52px', minBlockSize: '48px' }}
      onMdChange={(e) => {
        document.documentElement.setAttribute('data-theme', e.detail.selected ? 'dark' : 'light');
      }}
    />
  );
}
