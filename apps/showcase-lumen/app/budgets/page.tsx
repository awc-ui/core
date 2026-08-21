'use client';

// Budgets — one meter per category, with the limit edited in a bottom sheet.

import { useState } from 'react';
import {
  MdBottomSheet,
  MdButton,
  MdCard,
  MdIconButton,
  MdMeter,
  MdSlider,
  MdSnackbar,
} from '@awc-ui/react/server';
import { BUDGETS, currency, type Budget } from '../../lib/data';

const meterColor = (b: Budget) => {
  const ratio = b.spent / b.limit;
  if (ratio >= 1) return 'error';
  if (ratio >= 0.85) return 'warning';
  return 'success';
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState(BUDGETS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);

  const editing = budgets.find((b) => b.id === editingId) ?? null;

  const openEditor = (b: Budget) => {
    setDraftLimit(b.limit);
    setEditingId(b.id);
  };

  const saveLimit = () => {
    if (!editing) return;
    setBudgets((prev) => prev.map((b) => (b.id === editing.id ? { ...b, limit: draftLimit } : b)));
    setToastMessage(`${editing.name} limit set to ${currency(draftLimit)}`);
    setToastOpen(true);
    setEditingId(null);
  };

  return (
    <>
      <h2 className="section-title">Monthly budgets</h2>
      {budgets.map((b) => (
        <MdCard key={b.id} variant="outlined">
          <div className="budget-row">
            <div className="budget-meta">
              <MdMeter
                value={b.spent}
                min={0}
                max={b.limit}
                label={b.name}
                showLabel
                showValue
                valueText={`${currency(b.spent)} of ${currency(b.limit)}`}
                color={meterColor(b)}
                thickness={6}
              />
              <span className="budget-hint">
                {b.spent > b.limit
                  ? `${currency(b.spent - b.limit)} over budget`
                  : `${currency(b.limit - b.spent)} left this month`}
              </span>
            </div>
            <MdIconButton
              icon="tune"
              aria-label={`Adjust ${b.name} budget limit`}
              onClick={() => openEditor(b)}
            />
          </div>
        </MdCard>
      ))}

      <MdBottomSheet
        open={editing != null}
        headline={editing ? `Adjust ${editing.name} budget` : 'Adjust budget'}
        closeable
        onMdClose={() => setEditingId(null)}
      >
        <div className="sheet-body">
          <div className="sheet-amount">
            {currency(draftLimit)}
            <span>monthly limit</span>
          </div>
          <div className="sheet-slider">
            <MdSlider
              min={100}
              max={2000}
              step={25}
              value={draftLimit}
              aria-label="Monthly budget limit"
              valueIndicator
              onMdInput={(e) => setDraftLimit(e.detail.value)}
            />
          </div>
          {editing && (
            <p className="muted" style={{ margin: 0 }}>
              You have spent {currency(editing.spent)} on {editing.name.toLowerCase()} so far in
              August.
            </p>
          )}
        </div>
        <MdButton slot="actions" variant="text" onClick={() => setEditingId(null)}>
          Cancel
        </MdButton>
        <MdButton slot="actions" variant="filled" onClick={saveLimit}>
          Save limit
        </MdButton>
      </MdBottomSheet>

      <MdSnackbar
        open={toastOpen}
        message={toastMessage}
        closeable
        onMdClose={() => setToastOpen(false)}
      />
    </>
  );
}
