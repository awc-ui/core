'use client';

import React, { useRef, useState } from 'react';
import {
  MdChip,
  MdDivider,
  MdList,
  MdListItem,
  MdMenu,
  MdMenuItem,
  MdSnackbar,
  MdSplitButton,
  MdStatusDot,
} from '@awc-ui/react';
import { incidents as seed, type Incident, type Severity } from '../lib/data';

const DOT_STATE: Record<Severity, 'busy' | 'away' | 'online' | 'neutral'> = {
  critical: 'busy',
  major: 'away',
  minor: 'neutral',
  resolved: 'online',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  resolved: 'Resolved',
};

const TAG_COLOR: Record<Severity, string> = {
  critical: 'error',
  major: 'warning',
  minor: 'info',
  resolved: 'success',
};

export default function IncidentTimeline() {
  const [items, setItems] = useState<Incident[]>(seed);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const snackbarRef = useRef<React.ElementRef<typeof MdSnackbar> | null>(null);
  const [toast, setToast] = useState('');

  const notify = (message: string) => {
    setToast(message);
    void snackbarRef.current?.show();
  };

  const acknowledge = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, acked: true } : i)));
    notify(`${id} acknowledged — paging paused for this incident`);
  };

  const menuAction = (id: string, action: string) => {
    setOpenMenuFor(null);
    notify(`${id}: ${action}`);
  };

  return (
    <div className="incident-card">
      <MdList label="Incident timeline">
        {items.map((inc, idx) => (
          [
            <MdListItem key={inc.id} lines={3}>
              <span slot="leading" className="dot-anchor">
                <MdStatusDot
                  state={DOT_STATE[inc.severity]}
                  size="large"
                  label={`${SEVERITY_LABEL[inc.severity]} severity`}
                />
              </span>
              <span slot="overline">
                {inc.id} · {SEVERITY_LABEL[inc.severity]} · opened {inc.opened}
              </span>
              <span slot="headline">{inc.title}</span>
              <div slot="supporting-text">
                <p className="incident-desc">{inc.description}</p>
                <div className="incident-tags">
                  <MdChip
                    variant="suggestion"
                    appearance="filled"
                    color={TAG_COLOR[inc.severity]}
                    label={inc.service}
                  />
                  {inc.tags.map((tag) => (
                    <MdChip key={tag} variant="suggestion" label={tag} />
                  ))}
                </div>
              </div>
              <div slot="trailing" className="incident-actions">
                {inc.acked ? <span className="acked-note">Acked</span> : null}
                <MdSplitButton
                  id={`ack-${inc.id}`}
                  variant={inc.acked ? 'outlined' : 'tonal'}
                  size="sm"
                  icon={inc.acked ? 'done_all' : 'check'}
                  label={inc.acked ? 'Acknowledged' : 'Acknowledge'}
                  menuLabel={`More actions for ${inc.id}`}
                  haspopup="menu"
                  controls={`menu-${inc.id}`}
                  trailingChecked={openMenuFor === inc.id}
                  onMdLeadingClick={() => {
                    if (!inc.acked) acknowledge(inc.id);
                  }}
                  onMdTrailingClick={(e) =>
                    setOpenMenuFor(e.detail.checked ? inc.id : null)
                  }
                />
                <MdMenu
                  id={`menu-${inc.id}`}
                  anchor={`ack-${inc.id}`}
                  placement="bottom-end"
                  open={openMenuFor === inc.id}
                  onMdClose={() =>
                    setOpenMenuFor((cur) => (cur === inc.id ? null : cur))
                  }
                >
                  <MdMenuItem
                    headline="Escalate to on-call"
                    onMdClick={() => menuAction(inc.id, 'escalated to on-call')}
                  />
                  <MdMenuItem
                    headline="Assign owner"
                    onMdClick={() => menuAction(inc.id, 'owner assignment started')}
                  />
                  <MdMenuItem
                    headline="Mute paging for 1 hour"
                    divider
                    onMdClick={() => menuAction(inc.id, 'paging muted for 1 hour')}
                  />
                  <MdMenuItem
                    headline="Open runbook"
                    onMdClick={() => menuAction(inc.id, 'runbook opened')}
                  />
                </MdMenu>
              </div>
            </MdListItem>,
            idx < items.length - 1 ? <MdDivider key={`${inc.id}-div`} inset /> : null,
          ]
        ))}
      </MdList>
      <MdSnackbar ref={snackbarRef} message={toast} />
    </div>
  );
}
