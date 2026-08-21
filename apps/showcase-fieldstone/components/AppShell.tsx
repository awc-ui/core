'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  MdAppBar,
  MdBadge,
  MdIconButton,
  MdNavigationRail,
  MdNavigationRailTab,
} from '@awc-ui/react';

const DESTINATIONS = [
  { value: '/', icon: 'group', label: 'Users', badgeValue: '' },
  { value: '/roles', icon: 'admin_panel_settings', label: 'Roles', badgeValue: '' },
  { value: '/directory', icon: 'account_tree', label: 'Directory', badgeValue: '' },
  { value: '/audit', icon: 'receipt_long', label: 'Audit log', badgeValue: '5' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  const activeIndex = DESTINATIONS.findIndex((d) =>
    d.value === '/' ? pathname === '/' : pathname.startsWith(d.value),
  );

  return (
    <div className="shell">
      <MdAppBar
        headline="Fieldstone Ops"
        subtitle="Logistics admin console"
        leadingIcon="local_shipping"
        leadingIconLabel="Fieldstone Ops home"
      >
        <MdIconButton slot="trailing" icon="help" aria-label="Help center" />
        <span slot="trailing" className="bell-anchor">
          <MdIconButton icon="notifications" aria-label="Notifications, 3 unread" />
          <MdBadge value="3" />
        </span>
      </MdAppBar>

      <div className="shell-body">
        <MdNavigationRail
          className="shell-rail"
          label="Main navigation"
          activeIndex={activeIndex < 0 ? 0 : activeIndex}
          labelVisibility="all"
          onMdTabChange={(e) => router.push(e.detail.value)}
        >
          {DESTINATIONS.map((d) =>
            d.badgeValue ? (
              <MdNavigationRailTab
                key={d.value}
                icon={d.icon}
                label={d.label}
                value={d.value}
                badge
                badgeValue={d.badgeValue}
              />
            ) : (
              <MdNavigationRailTab key={d.value} icon={d.icon} label={d.label} value={d.value} />
            ),
          )}
        </MdNavigationRail>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
