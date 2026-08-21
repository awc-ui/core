'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MdNavigationRail, MdNavigationRailTab } from '@awc-ui/react';
import { incidents } from '../lib/data';

const DESTINATIONS = [
  { value: '/', icon: 'hub', label: 'Services' },
  { value: '/latency', icon: 'monitoring', label: 'Latency' },
  { value: '/requests', icon: 'receipt_long', label: 'Requests' },
  { value: '/incidents', icon: 'warning', label: 'Incidents' },
];

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = DESTINATIONS.findIndex((d) =>
    d.value === '/' ? pathname === '/' : pathname.startsWith(d.value),
  );

  const openIncidents = incidents.filter(
    (i) => i.severity !== 'resolved' && !i.acked,
  ).length;

  return (
    <div className="shell">
      <aside className="shell-rail">
        <MdNavigationRail
          label="Relaymesh navigation"
          fullHeight
          activeIndex={activeIndex}
          onMdTabChange={(e) => router.push(e.detail.value)}
        >
          <div slot="logo" className="brand-mark" aria-label="Relaymesh">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M14 2 L26 14 L14 26 L2 14 Z"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <circle cx="14" cy="14" r="3.4" fill="currentColor" />
            </svg>
            <span className="brand-name">Relaymesh</span>
          </div>
          {DESTINATIONS.map((d) => (
            <MdNavigationRailTab
              key={d.value}
              icon={d.icon}
              label={d.label}
              value={d.value}
              badgeValue={
                d.value === '/incidents' && openIncidents > 0
                  ? String(openIncidents)
                  : undefined
              }
            />
          ))}
        </MdNavigationRail>
      </aside>
      <main className="shell-main">{children}</main>
    </div>
  );
}
