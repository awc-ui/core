'use client';

import { useMemo, useState } from 'react';
import {
  MdList,
  MdListItem,
  MdSearch,
  MdTable,
  MdTableBody,
  MdTableCell,
  MdTableContainer,
  MdTableExpandToggle,
  MdTableHead,
  MdTableRow,
} from '@awc-ui/react';
import { requestLog, type LogEntry } from '../lib/data';

function codeClass(status: number): string {
  if (status >= 500) return 'err';
  if (status >= 400) return 'warn';
  return 'ok';
}

function matches(entry: LogEntry, q: string): boolean {
  const hay =
    `${entry.id} ${entry.method} ${entry.endpoint} ${entry.status} ${entry.service}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function RequestLog() {
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => (query ? requestLog.filter((e) => matches(e, query)) : requestLog),
    [query],
  );

  const suggestions = useMemo(() => {
    if (!query) return [];
    return rows.slice(0, 6);
  }, [rows, query]);

  return (
    <div className="chart-stack">
      <div className="reqlog-toolbar">
        <div className="reqlog-search">
          <MdSearch
            layout="docked"
            trigger="bar"
            placeholder="Filter by endpoint, method, status or service"
            inputAriaLabel="Filter request log"
            debounce={150}
            onMdSearch={(e) => setQuery(e.detail.value)}
            onMdClear={() => setQuery('')}
          >
            <div slot="results">
              {suggestions.length > 0 ? (
                <MdList label="Matching requests">
                  {suggestions.map((s) => (
                    <MdListItem
                      key={s.id}
                      type="button"
                      headline={`${s.method} ${s.endpoint}`}
                      supportingText={`${s.id} · ${s.status} · ${s.latency} ms`}
                      onMdClick={() => setQuery(s.endpoint)}
                    />
                  ))}
                </MdList>
              ) : (
                <p style={{ margin: 0, padding: 16 }} className="svc-meta">
                  {query
                    ? 'No requests match this filter.'
                    : 'Type to filter the live request log.'}
                </p>
              )}
            </div>
          </MdSearch>
        </div>
        <span className="reqlog-count" role="status">
          {rows.length} of {requestLog.length} requests
          {query ? ` · filter “${query}”` : ''}
        </span>
      </div>

      <MdTableContainer maxHeight="64vh">
        <MdTable
          label="Request log"
          columnTemplate="48px 110px 96px minmax(240px, 2fr) 96px 110px 150px"
          minWidth="880px"
          stickyHeader
          striped
          density="compact"
        >
          <MdTableHead>
            <MdTableRow rowgroup="head">
              <MdTableCell head scope="col" aria-label="Expand" />
              <MdTableCell head scope="col">
                Time
              </MdTableCell>
              <MdTableCell head scope="col">
                Method
              </MdTableCell>
              <MdTableCell head scope="col">
                Endpoint
              </MdTableCell>
              <MdTableCell head scope="col">
                Status
              </MdTableCell>
              <MdTableCell head scope="col" numeric>
                Latency
              </MdTableCell>
              <MdTableCell head scope="col">
                Service
              </MdTableCell>
            </MdTableRow>
          </MdTableHead>
          <MdTableBody>
            {rows.map((entry) => (
              <MdTableRow key={entry.id} value={entry.id} expandable>
                <MdTableCell>
                  <MdTableExpandToggle buttonLabel={`Expand ${entry.id}`} />
                </MdTableCell>
                <MdTableCell>
                  <span className="mono">{entry.time}</span>
                </MdTableCell>
                <MdTableCell>
                  <span className="mono">{entry.method}</span>
                </MdTableCell>
                <MdTableCell>
                  <span className="mono">{entry.endpoint}</span>
                </MdTableCell>
                <MdTableCell>
                  <span className={`code-pill ${codeClass(entry.status)}`}>
                    {entry.status}
                  </span>
                </MdTableCell>
                <MdTableCell numeric>{entry.latency} ms</MdTableCell>
                <MdTableCell>{entry.service}</MdTableCell>
                <div slot="expanded" className="payload-panel">
                  <h3>
                    {entry.id} · payload · handled by {entry.service}
                  </h3>
                  <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                </div>
              </MdTableRow>
            ))}
          </MdTableBody>
        </MdTable>
      </MdTableContainer>
    </div>
  );
}
