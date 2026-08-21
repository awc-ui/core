'use client';

import { useState } from 'react';
import { MdAvatar, MdChip, MdOrganizationChart, MdSideSheet } from '@awc-ui/react';
import { ORG_NODES, PROFILES } from '../../lib/data';

export default function DirectoryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const profile = selectedId ? PROFILES[selectedId] : null;

  return (
    <>
      <h1 className="page-header">Org directory</h1>
      <p className="page-subtitle">
        Reporting lines across Fieldstone&apos;s network. Select a person to open their
        profile.
      </p>

      <div className="directory-layout">
        <div className="panel directory-chart">
          <MdOrganizationChart
            label="Fieldstone organization chart"
            selectionMode="single"
            nodes={ORG_NODES as never}
            onMdSelectionChange={(e) => {
              const ids = e.detail.selectedIds as string[];
              setSelectedId(ids.length > 0 ? ids[0] : null);
            }}
          >
            <div slot="empty">No people yet.</div>
          </MdOrganizationChart>
        </div>

        <MdSideSheet
          variant="standard"
          side="end"
          open={!!profile}
          headline={profile?.name ?? 'Profile'}
          onMdClose={() => setSelectedId(null)}
        >
          {profile && (
            <div className="profile-body">
              <div className="profile-head">
                <MdAvatar name={profile.name} size="large" label={profile.name} />
                <div>
                  <p className="profile-title">{profile.name}</p>
                  <p className="profile-role">{profile.title}</p>
                </div>
              </div>

              <dl className="profile-facts">
                <div>
                  <dt>Depot</dt>
                  <dd>{profile.depot}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{profile.phone}</dd>
                </div>
                <div>
                  <dt>Direct reports</dt>
                  <dd>{profile.reports}</dd>
                </div>
                <div>
                  <dt>Tenure</dt>
                  <dd>{profile.tenure}</dd>
                </div>
              </dl>

              <div className="profile-chips">
                {profile.focus.map((f) => (
                  <MdChip key={f} label={f} color="secondary" />
                ))}
              </div>
            </div>
          )}
        </MdSideSheet>
      </div>
    </>
  );
}
