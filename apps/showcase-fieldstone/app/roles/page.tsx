'use client';

import { useMemo, useState } from 'react';
import {
  MdButton,
  MdChip,
  MdDialog,
  MdSelect,
  MdSelectOption,
  MdTransferList,
} from '@awc-ui/react';
import { CAPABILITIES, DEFAULT_ROLE_CAPS, ROLE_META, type RoleId } from '../../lib/data';

const ROLE_IDS = Object.keys(ROLE_META) as RoleId[];

const capLabel = (value: string) =>
  CAPABILITIES.find((c) => c.value === value)?.label ?? value;

export default function RolesPage() {
  const [role, setRole] = useState<RoleId>('dispatcher');
  const [saved, setSaved] = useState<Record<RoleId, string[]>>(DEFAULT_ROLE_CAPS);
  const [draft, setDraft] = useState<string[]>(DEFAULT_ROLE_CAPS.dispatcher);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const current = saved[role];

  const added = useMemo(() => draft.filter((v) => !current.includes(v)), [draft, current]);
  const removed = useMemo(() => current.filter((v) => !draft.includes(v)), [draft, current]);
  const dirty = added.length > 0 || removed.length > 0;

  const pickRole = (next: RoleId) => {
    setRole(next);
    setDraft(saved[next]);
    setStatusMsg('');
  };

  const apply = () => {
    setSaved((prev) => ({ ...prev, [role]: draft }));
    setDialogOpen(false);
    setStatusMsg(
      `Saved ${ROLE_META[role].label}: ${added.length} capabilit${added.length === 1 ? 'y' : 'ies'} granted, ${removed.length} revoked.`,
    );
  };

  return (
    <>
      <h1 className="page-header">Roles &amp; permissions</h1>
      <p className="page-subtitle">
        Choose a role, then move capabilities between the pools. Nothing applies until you
        confirm.
      </p>

      <div className="roles-grid">
        <div className="roles-side panel">
          <MdSelect
            label="Role"
            value={role}
            supportingText="Changes affect everyone holding the role"
            onMdChange={(e) => pickRole(e.detail as RoleId)}
          >
            {ROLE_IDS.map((id) => (
              <MdSelectOption key={id} value={id}>
                {ROLE_META[id].label}
              </MdSelectOption>
            ))}
          </MdSelect>

          <p className="role-blurb">{ROLE_META[role].blurb}</p>

          <div className="diff-list" aria-label="Currently granted capabilities">
            {current.map((v) => (
              <MdChip key={v} label={capLabel(v)} color={ROLE_META[role].color} />
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Capabilities for {ROLE_META[role].label}</h2>
          <p className="panel-caption">
            Left: available in the catalog. Right: granted to this role. Depot settings are
            locked to Admin by policy.
          </p>

          <MdTransferList
            sourceTitle="Capability catalog"
            targetTitle={`Granted to ${ROLE_META[role].label}`}
            sourceSearchPlaceholder="Search catalog"
            targetSearchPlaceholder="Search granted"
            items={CAPABILITIES}
            value={draft}
            style={{ width: '100%' }}
            onMdChange={(e) => setDraft(e.detail as string[])}
          />

          <div className="roles-actions">
            <MdButton
              variant="filled"
              icon="rule"
              disabled={!dirty}
              onClick={() => setDialogOpen(true)}
            >
              Review &amp; save
            </MdButton>
            <MdButton variant="text" disabled={!dirty} onClick={() => setDraft(current)}>
              Discard changes
            </MdButton>
          </div>

          <p className="status-line" role="status">
            {statusMsg}
          </p>
        </div>
      </div>

      <MdDialog
        open={dialogOpen}
        headline={`Apply changes to ${ROLE_META[role].label}?`}
        icon="admin_panel_settings"
        onMdClose={() => setDialogOpen(false)}
      >
        <p style={{ margin: 0 }}>
          This updates every account holding the {ROLE_META[role].label} role immediately.
        </p>
        {added.length > 0 && (
          <>
            <p className="diff-heading">Granting</p>
            <div className="diff-list">
              {added.map((v) => (
                <MdChip key={v} label={capLabel(v)} color="success" icon="add" />
              ))}
            </div>
          </>
        )}
        {removed.length > 0 && (
          <>
            <p className="diff-heading">Revoking</p>
            <div className="diff-list">
              {removed.map((v) => (
                <MdChip key={v} label={capLabel(v)} color="error" icon="remove" />
              ))}
            </div>
          </>
        )}

        <MdButton slot="actions" variant="text" onClick={() => setDialogOpen(false)}>
          Cancel
        </MdButton>
        <MdButton slot="actions" variant="filled" onClick={apply}>
          Apply changes
        </MdButton>
      </MdDialog>
    </>
  );
}
