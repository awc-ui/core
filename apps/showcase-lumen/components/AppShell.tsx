'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MdAppBar, MdIconButton, MdNavigationBar, MdNavigationTab } from '@awc-ui/react/server';

const DESTINATIONS = [
  {
    path: '/',
    label: 'Accounts',
    icon: 'account_balance_wallet',
    headline: 'Lumen Bank',
    subtitle: 'Good afternoon, Anneke',
  },
  {
    path: '/transactions',
    label: 'Activity',
    icon: 'receipt_long',
    headline: 'Transactions',
    subtitle: 'Everyday Checking ··4821',
  },
  {
    path: '/transfer',
    label: 'Transfer',
    icon: 'sync_alt',
    headline: 'Transfer money',
    subtitle: 'To saved payees and accounts',
  },
  {
    path: '/budgets',
    label: 'Budgets',
    icon: 'donut_small',
    headline: 'Budgets',
    subtitle: 'August 2026',
  },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const found = DESTINATIONS.findIndex((d) => d.path === pathname);
  const index = found >= 0 ? found : 0;
  const dest = DESTINATIONS[index];

  return (
    <>
      <MdAppBar headline={dest.headline} subtitle={dest.subtitle}>
        <MdIconButton slot="trailing" icon="account_circle" aria-label="Your profile" />
      </MdAppBar>

      <main className="page">{children}</main>

      <div className="nav-dock">
        <MdNavigationBar
          activeIndex={index}
          aria-label="Main navigation"
          onMdChange={(e) => {
            const next = DESTINATIONS[e.detail.index];
            if (next && next.path !== pathname) router.push(next.path);
          }}
        >
          {DESTINATIONS.map((d) => (
            <MdNavigationTab key={d.path} label={d.label} icon={d.icon} />
          ))}
        </MdNavigationBar>
      </div>
    </>
  );
}
