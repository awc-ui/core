'use client';

import { useMemo, useRef, useState } from 'react';
import {
  MdAvatar,
  MdButton,
  MdCheckbox,
  MdChip,
  MdMenu,
  MdMenuItem,
  MdSearch,
  MdSplitButton,
  MdStatusDot,
  MdTable,
  MdTableBody,
  MdTableCell,
  MdTableContainer,
  MdTableExpandToggle,
  MdTableHead,
  MdTablePagination,
  MdTableRow,
  MdTableSortLabel,
  MdTableToolbar,
} from '@awc-ui/react';
import { ROLE_META, USERS, type User } from '../lib/data';

type SortKey = 'name' | 'depot' | 'lastActive' | '';
type SortOrder = 'asc' | 'desc' | 'none';

const PRESENCE_LABEL: Record<User['presence'], string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

export default function UsersPage() {
  const tableRef = useRef<HTMLElement & { deselectAll(): Promise<void> }>(null);

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return USERS;
    return USERS.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.depot.toLowerCase().includes(q) ||
        ROLE_META[u.role].label.toLowerCase().includes(q),
    );
  }, [query]);

  const sorted = useMemo(() => {
    if (!sortBy || sortOrder === 'none') return filtered;
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sortBy, sortOrder]);

  const lastPage = Math.max(0, Math.ceil(sorted.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);
  const pageRows = sorted.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

  const exportUsers = (format: string) => {
    const n = selectedCount > 0 ? selectedCount : filtered.length;
    const scope = selectedCount > 0 ? 'selected ' : '';
    setStatusMsg(`Exported ${n} ${scope}team member${n === 1 ? '' : 's'} as ${format}.`);
  };

  const searchHits = useMemo(() => filtered.slice(0, 6), [filtered]);

  return (
    <>
      <h1 className="page-header">Users</h1>
      <p className="page-subtitle">
        Everyone with access to the Fieldstone Ops console, across all five depots.
      </p>

      <MdTableContainer variant="outlined" maxHeight="64vh">
        <MdTableToolbar
          slot="top"
          headline="Team members"
          supportingText={`${filtered.length} of ${USERS.length} people`}
          numSelected={selectedCount}
        >
          <div slot="actions" className="users-toolbar-actions">
            <MdSearch
              layout="docked"
              trigger="bar"
              placeholder="Search people"
              inputAriaLabel="Search team members"
              debounce={150}
              onMdSearch={(e) => {
                setQuery(e.detail.value);
                setPage(0);
              }}
            >
              <div slot="results" className="search-results">
                {searchHits.length === 0 ? (
                  <div className="search-empty">No one matches that search.</div>
                ) : (
                  searchHits.map((u) => (
                    <div key={u.id} className="search-hit">
                      <div className="search-hit-name">{u.name}</div>
                      <div className="search-hit-meta">
                        {ROLE_META[u.role].label} · {u.depot}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </MdSearch>

            <MdSplitButton
              id="export-btn"
              variant="tonal"
              icon="download"
              label="Export"
              menuLabel="More export formats"
              haspopup="menu"
              controls="export-menu"
              trailingChecked={menuOpen}
              onMdLeadingClick={() => exportUsers('CSV')}
              onMdTrailingClick={(e) => setMenuOpen(e.detail.checked)}
            />
          </div>

          <MdButton
            slot="selection-actions"
            variant="tonal"
            icon="pause_circle"
            onClick={() => {
              setStatusMsg(
                `Suspended ${selectedValues.length} account${selectedValues.length === 1 ? '' : 's'} pending review.`,
              );
              tableRef.current?.deselectAll();
            }}
          >
            Suspend
          </MdButton>
          <MdButton
            slot="selection-actions"
            variant="text"
            onClick={() => tableRef.current?.deselectAll()}
          >
            Clear
          </MdButton>
        </MdTableToolbar>

        <MdTable
          ref={tableRef as never}
          label="Team members"
          columnTemplate="48px 48px 2.4fr 1.2fr 1fr 1fr"
          minWidth="880px"
          stickyHeader
          selection="multiple"
          sortBy={sortBy}
          sortOrder={sortOrder}
          rowOffset={safePage * rowsPerPage}
          rowCount={sorted.length}
          empty={pageRows.length === 0}
          onMdSortChange={(e) => {
            setSortBy(e.detail.column as SortKey);
            setSortOrder(e.detail.order as SortOrder);
          }}
          onMdSelectionChange={(e) => {
            setSelectedCount(e.detail.count);
            setSelectedValues(e.detail.values as string[]);
          }}
        >
          <MdTableHead>
            <MdTableRow rowgroup="head">
              <MdTableCell head padding="checkbox" aria-label="Row details" />
              <MdTableCell head padding="checkbox">
                <MdCheckbox aria-label="Select all team members" />
              </MdTableCell>
              <MdTableCell head scope="col">
                <MdTableSortLabel column="name">Name</MdTableSortLabel>
              </MdTableCell>
              <MdTableCell head scope="col">
                Role
              </MdTableCell>
              <MdTableCell head scope="col">
                <MdTableSortLabel column="depot">Depot</MdTableSortLabel>
              </MdTableCell>
              <MdTableCell head scope="col">
                <MdTableSortLabel column="lastActive" defaultOrder="desc">
                  Last active
                </MdTableSortLabel>
              </MdTableCell>
            </MdTableRow>
          </MdTableHead>

          <MdTableBody>
            {pageRows.map((u) => (
              <MdTableRow key={u.id} value={u.id} expandable>
                <MdTableCell padding="checkbox">
                  <MdTableExpandToggle buttonLabel={`Details for ${u.name}`} />
                </MdTableCell>
                <MdTableCell padding="checkbox">
                  <MdCheckbox aria-label={`Select ${u.name}`} />
                </MdTableCell>
                <MdTableCell>
                  <div className="user-cell">
                    <span className="avatar-wrap">
                      <MdAvatar
                        name={u.name}
                        size="small"
                        label={`${u.name}, ${PRESENCE_LABEL[u.presence]}`}
                      />
                      <MdStatusDot state={u.presence} size="small" />
                    </span>
                    <span className="user-id">
                      <span className="user-name">{u.name}</span>
                      <br />
                      <span className="user-email">{u.email}</span>
                    </span>
                  </div>
                </MdTableCell>
                <MdTableCell>
                  <MdChip label={ROLE_META[u.role].label} color={ROLE_META[u.role].color} />
                </MdTableCell>
                <MdTableCell>{u.depot}</MdTableCell>
                <MdTableCell>
                  <span className="mono">{u.lastActive}</span>
                </MdTableCell>

                <div slot="expanded">
                  <dl className="row-detail">
                    <div>
                      <dt>Phone</dt>
                      <dd>{u.phone}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{u.region}</dd>
                    </div>
                    <div>
                      <dt>Shift</dt>
                      <dd>{u.shift}</dd>
                    </div>
                    <div>
                      <dt>Presence</dt>
                      <dd>{PRESENCE_LABEL[u.presence]}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>{u.startDate}</dd>
                    </div>
                  </dl>
                </div>
              </MdTableRow>
            ))}
          </MdTableBody>

          <div slot="empty" className="audit-empty">
            No team members match the current search.
          </div>
        </MdTable>

        <MdTablePagination
          slot="bottom"
          count={sorted.length}
          page={safePage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions="5,10,25"
          onMdPageChange={(e) => setPage(e.detail.page)}
          onMdRowsPerPageChange={(e) => {
            setRowsPerPage(e.detail.rowsPerPage);
            setPage(0);
          }}
        />
      </MdTableContainer>

      <MdMenu
        id="export-menu"
        anchor="export-btn"
        placement="bottom-end"
        open={menuOpen}
        onMdClose={() => setMenuOpen(false)}
      >
        <MdMenuItem headline="CSV spreadsheet" onMdClick={() => exportUsers('CSV')} />
        <MdMenuItem headline="JSON snapshot" onMdClick={() => exportUsers('JSON')} />
        <MdMenuItem headline="PDF summary" divider onMdClick={() => exportUsers('PDF')} />
      </MdMenu>

      <p className="status-line" role="status">
        {statusMsg}
      </p>
    </>
  );
}
