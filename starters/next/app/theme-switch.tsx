'use client';

// Dark mode: data-theme="dark" on <html> swaps the token palette.
import { MdSwitch } from '@awc-ui/react';

export function ThemeSwitch() {
  return (
    <MdSwitch
      slot="trailing"
      icons
      aria-label="Dark mode"
      onMdChange={(e) => {
        document.documentElement.setAttribute('data-theme', e.detail.selected ? 'dark' : 'light');
      }}
    />
  );
}
