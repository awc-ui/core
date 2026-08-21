'use client';

import { useMemo, useState } from 'react';
import {
  MdChip,
  MdDatePicker,
  MdSegmentedButton,
  MdSegmentedButtonSet,
  MdTable,
  MdTableBody,
  MdTableCell,
  MdTableContainer,
  MdTableHead,
  MdTableRow,
} from '@awc-ui/react';
import { AUDIT_EVENTS, SEVERITY_META, type Severity } from '../../lib/data';

const ALL_SEVERITIES: Severity[] = ['info', 'warning', 'critical'];

export default function AuditPage() {
  const [from, setFrom] = useState('2026-08-16');
  const [to, setTo] = useState('2026-08-22');
  const [severities, setSeverities] = useState<Severity[]>(ALL_SEVERITIES);

  const filtered = useMemo(
    () =>
      AUDIT_EVENTS.filter(
        (ev) =>
          (!from || ev.date >= from) &&
          (!to || ev.date <= to) &&
          severities.includes(ev.severity),
      ),
    [from, to, severities],
  );

  return (
    <>
      <h1 className="page-header">Audit log</h1>
      <p className="page-subtitle">
        Every privileged action in the console, retained for 18 months.
      </p>

      <div className="audit-filters">
        <div>
          <span className="audit-filter-label" id="from-label">
            From
          </span>
          <MdDatePicker
            variant="docked"
            label="From"
            value={from}
            min="2026-08-01"
            max="2026-08-22"
            onMdChange={(e) => setFrom(e.detail.value)}
          />
        </div>
        <div>
          <span className="audit-filter-label" id="to-label">
            To
          </span>
          <MdDatePicker
            variant="docked"
            label="To"
            value={to}
            min="2026-08-01"
            max="2026-08-22"
            onMdChange={(e) => setTo(e.detail.value)}
          />
        </div>
        <div>
          <span className="audit-filter-label">Severity</span>
          <MdSegmentedButtonSet
            multiselect
            aria-label="Filter by severity"
            onMdChange={(e) => setSeverities(e.detail as Severity[])}
          >
            {ALL_SEVERITIES.map((s) => (
              <MdSegmentedButton
                key={s}
                value={s}
                label={SEVERITY_META[s].label}
                selected={severities.includes(s)}
              />
            ))}
          </MdSegmentedButtonSet>
        </div>
        <span className="audit-count">
          {filtered.length} of {AUDIT_EVENTS.length} events
        </span>
      </div>

      <MdTableContainer variant="outlined" maxHeight="60vh">
        <MdTable
          label="Audit log"
          columnTemplate="150px 1.2fr 1.6fr 1.4fr 130px"
          minWidth="820px"
          stickyHeader
          striped
          empty={filtered.length === 0}
        >
          <MdTableHead>
            <MdTableRow rowgroup="head">
              <MdTableCell head scope="col">
                Time
              </MdTableCell>
              <MdTableCell head scope="col">
                Actor
              </MdTableCell>
              <MdTableCell head scope="col">
                Action
              </MdTableCell>
              <MdTableCell head scope="col">
                Target
              </MdTableCell>
              <MdTableCell head scope="col">
                Severity
              </MdTableCell>
            </MdTableRow>
          </MdTableHead>

          <MdTableBody>
            {filtered.map((ev) => (
              <MdTableRow key={ev.id} value={ev.id}>
                <MdTableCell>
                  <span className="mono">{ev.ts}</span>
                </MdTableCell>
                <MdTableCell>{ev.actor}</MdTableCell>
                <MdTableCell>{ev.action}</MdTableCell>
                <MdTableCell>{ev.target}</MdTableCell>
                <MdTableCell>
                  <MdChip
                    label={SEVERITY_META[ev.severity].label}
                    color={SEVERITY_META[ev.severity].color}
                  />
                </MdTableCell>
              </MdTableRow>
            ))}
          </MdTableBody>

          <div slot="empty" className="audit-empty">
            No events in this range. Widen the dates or add a severity.
          </div>
        </MdTable>
      </MdTableContainer>
    </>
  );
}
