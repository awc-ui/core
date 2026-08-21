// A Next.js Server Component. The static components come from
// `@awc-ui/react/server`, which server-renders each component's Declarative
// Shadow DOM (via @awc-ui/core/hydrate) and hydrates on the client — so the
// very first paint is styled, no flash. The interactive pieces (theme switch,
// chart with JS-property data) are small client components.
import {
  MdAppBar,
  MdCard,
  MdTable,
  MdTableContainer,
  MdTableHead,
  MdTableBody,
  MdTableRow,
  MdTableCell,
} from '@awc-ui/react/server';
import { ThemeSwitch } from './theme-switch';
import { SessionsChart } from './sessions-chart';

function StatCard({
  label,
  value,
  delta,
  variant,
}: {
  label: string;
  value: string;
  delta: string;
  variant: 'elevated' | 'filled';
}) {
  return (
    <MdCard variant={variant}>
      <div style={{ padding: 16, display: 'grid', gap: 4 }}>
        <span style={{ font: 'var(--md-sys-typescale-label-large)', color: 'var(--md-sys-color-on-surface-variant)' }}>
          {label}
        </span>
        <span style={{ font: 'var(--md-sys-typescale-headline-medium)' }}>{value}</span>
        <span style={{ font: 'var(--md-sys-typescale-body-small)', color: 'var(--md-sys-color-primary)' }}>
          {delta}
        </span>
      </div>
    </MdCard>
  );
}

export default function Page() {
  return (
    <>
      <MdAppBar headline="Acme Analytics" subtitle="Overview">
        <ThemeSwitch />
      </MdAppBar>

      <main
        style={{
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          gap: 20,
          maxWidth: 840,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard label="Revenue" value="$48.2k" delta="+12% vs last month" variant="elevated" />
          <StatCard label="Active users" value="1,284" delta="+4.6% vs last month" variant="filled" />
        </div>

        <MdCard variant="outlined">
          <div style={{ padding: 16 }}>
            <SessionsChart />
          </div>
        </MdCard>

        <MdTableContainer>
          <MdTable columnTemplate="2fr 1fr 1fr" label="Recent invoices" striped>
            <MdTableHead>
              <MdTableRow rowgroup="head">
                <MdTableCell head scope="col">Client</MdTableCell>
                <MdTableCell head scope="col" numeric>Amount</MdTableCell>
                <MdTableCell head scope="col">Status</MdTableCell>
              </MdTableRow>
            </MdTableHead>
            <MdTableBody>
              <MdTableRow value="inv-1">
                <MdTableCell>Acme Corp</MdTableCell>
                <MdTableCell numeric>$1,200</MdTableCell>
                <MdTableCell>Paid</MdTableCell>
              </MdTableRow>
              <MdTableRow value="inv-2">
                <MdTableCell>Globex</MdTableCell>
                <MdTableCell numeric>$860</MdTableCell>
                <MdTableCell>Pending</MdTableCell>
              </MdTableRow>
              <MdTableRow value="inv-3">
                <MdTableCell>Initech</MdTableCell>
                <MdTableCell numeric>$2,400</MdTableCell>
                <MdTableCell>Paid</MdTableCell>
              </MdTableRow>
            </MdTableBody>
          </MdTable>
        </MdTableContainer>
      </main>
    </>
  );
}
