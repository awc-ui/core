'use client';

// Transactions — searchable, chip-filterable table with expandable rows.

import { useMemo, useRef, useState } from 'react';
import {
  MdChip,
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
} from '@awc-ui/react/server';
import { CATEGORIES, TRANSACTIONS, currency, type Category } from '../../lib/data';

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState<Category[]>([]);
  const searchRef = useRef<HTMLElement & { close: () => Promise<void>; value: string }>(null);

  const toggleCategory = (cat: Category, selected: boolean) => {
    setActive((prev) => (selected ? [...prev, cat] : prev.filter((c) => c !== cat)));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRANSACTIONS.filter((t) => {
      const matchesQuery = q === '' || t.merchant.toLowerCase().includes(q);
      const matchesCategory = active.length === 0 || active.includes(t.category);
      return matchesQuery && matchesCategory;
    });
  }, [query, active]);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const merchants = [...new Set(TRANSACTIONS.map((t) => t.merchant))];
    return (q === '' ? merchants.slice(0, 4) : merchants.filter((m) => m.toLowerCase().includes(q))).slice(0, 6);
  }, [draft]);

  const pickSuggestion = (merchant: string) => {
    setQuery(merchant);
    setDraft(merchant);
    if (searchRef.current) {
      searchRef.current.value = merchant;
      searchRef.current.close();
    }
  };

  return (
    <>
      <MdSearch
        ref={searchRef as never}
        layout="docked"
        trigger="bar"
        placeholder="Search merchants"
        inputAriaLabel="Search transactions by merchant"
        debounce={150}
        fullWidth
        onMdInput={(e) => setDraft(e.detail.value)}
        onMdSearch={(e) => setQuery(e.detail.value)}
        onMdClear={() => {
          setQuery('');
          setDraft('');
        }}
      >
        <MdList slot="results" label="Merchant suggestions">
          {suggestions.map((m) => (
            <MdListItem
              key={m}
              type="button"
              headline={m}
              leadingIcon="storefront"
              onMdClick={() => pickSuggestion(m)}
            />
          ))}
        </MdList>
      </MdSearch>

      <div className="chip-row" role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <MdChip
            key={cat}
            variant="filter"
            label={cat}
            selected={active.includes(cat)}
            onMdSelect={(e) => toggleCategory(cat, e.detail.selected)}
          />
        ))}
      </div>

      <MdTableContainer>
        <MdTable
          label="Transactions"
          columnTemplate="44px 92px minmax(160px, 2fr) minmax(110px, 1fr) 110px"
          minWidth="620px"
          keepHeight={false}
          empty={filtered.length === 0}
          summary="Recent transactions across your Lumen Bank accounts. Expand a row for reference details."
        >
          <MdTableHead>
            <MdTableRow rowgroup="head">
              <MdTableCell head scope="col">
                <span className="visually-hidden">Details</span>
              </MdTableCell>
              <MdTableCell head scope="col">
                Date
              </MdTableCell>
              <MdTableCell head scope="col">
                Merchant
              </MdTableCell>
              <MdTableCell head scope="col">
                Category
              </MdTableCell>
              <MdTableCell head scope="col" numeric>
                Amount
              </MdTableCell>
            </MdTableRow>
          </MdTableHead>
          <MdTableBody>
            {filtered.map((t) => (
              <MdTableRow key={t.id} value={t.id} expandable>
                <MdTableCell padding="checkbox">
                  <MdTableExpandToggle buttonLabel={`Details for ${t.merchant}`} />
                </MdTableCell>
                <MdTableCell>{t.date}</MdTableCell>
                <MdTableCell>{t.merchant}</MdTableCell>
                <MdTableCell>{t.category}</MdTableCell>
                <MdTableCell numeric>
                  <span className={t.amount > 0 ? 'amount-credit' : 'amount-debit'}>
                    {t.amount > 0 ? '+' : ''}
                    {currency(t.amount)}
                  </span>
                </MdTableCell>
                <div slot="expanded" className="tx-detail">
                  <div>
                    <span className="k">Account</span>
                    <span className="v">{t.account}</span>
                  </div>
                  <div>
                    <span className="k">Reference</span>
                    <span className="v">{t.reference}</span>
                  </div>
                  <div>
                    <span className="k">Status</span>
                    <span className="v">{t.status}</span>
                  </div>
                  <div>
                    <span className="k">Note</span>
                    <span className="v">{t.note}</span>
                  </div>
                </div>
              </MdTableRow>
            ))}
          </MdTableBody>
        </MdTable>
      </MdTableContainer>
      <p className="muted" style={{ margin: 0 }}>
        Showing {filtered.length} of {TRANSACTIONS.length} transactions.
      </p>
    </>
  );
}
