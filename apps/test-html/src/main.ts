/**
 * AWC UI — Vanilla HTML playground bootstrap.
 *
 * Mirrors the React / Vue / Svelte / Angular playgrounds so the same
 * 34 components are exercised, but without any framework binding. Just
 * the published web components + a small amount of plain DOM wiring
 * for the interactive bits (theme toggle, dialog/menu open state, etc.).
 */
import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';

defineCustomElements(window);

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
themeToggle?.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark'
    ? ''
    : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// ---------------------------------------------------------------------------
// Checkbox + label sync
// ---------------------------------------------------------------------------
const cb = document.getElementById('hello-cb');
const cbLabel = document.getElementById('cb-label');
cb?.addEventListener('mdChange', ((e: CustomEvent<{ checked: boolean }>) => {
  if (!cbLabel) return;
  cbLabel.textContent = e.detail.checked
    ? 'Checkbox (checked)'
    : 'Checkbox (unchecked)';
}) as EventListener);

// ---------------------------------------------------------------------------
// Switch + label sync
// ---------------------------------------------------------------------------
const sw = document.getElementById('sw1');
const swLabel = document.getElementById('sw1-label');
sw?.addEventListener('mdChange', ((e: CustomEvent<boolean>) => {
  if (!swLabel) return;
  swLabel.textContent = e.detail ? 'On' : 'Off';
}) as EventListener);

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------
type WithOpen = HTMLElement & { open?: boolean };
const dialog = document.getElementById('dialog') as WithOpen | null;
document
  .getElementById('dialog-open')
  ?.addEventListener('click', () => dialog && (dialog.open = true));
document
  .getElementById('dialog-cancel')
  ?.addEventListener('click', () => dialog && (dialog.open = false));
document
  .getElementById('dialog-confirm')
  ?.addEventListener('click', () => dialog && (dialog.open = false));
dialog?.addEventListener('mdCancel', () => dialog && (dialog.open = false));

// ---------------------------------------------------------------------------
// Snackbar
// ---------------------------------------------------------------------------
type WithShow = HTMLElement & { show?: () => void };
document.getElementById('snackbar-open')?.addEventListener('click', () => {
  const snack = document.getElementById('snackbar') as WithShow | null;
  snack?.show?.();
});

// ---------------------------------------------------------------------------
// Menu (anchored to the "Open Menu" button)
// ---------------------------------------------------------------------------
const menu = document.getElementById('menu') as WithOpen | null;
const menuAnchor = document.getElementById('menu-anchor');
menuAnchor?.addEventListener('click', () => {
  if (!menu) return;
  menu.open = !menu.open;
  menuAnchor.textContent = menu.open ? 'Close Menu' : 'Open Menu';
});

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------
const sheet = document.getElementById('bottom-sheet') as WithOpen | null;
const sheetToggle = document.getElementById('sheet-toggle');
sheetToggle?.addEventListener('click', () => {
  if (!sheet) return;
  sheet.open = !sheet.open;
  sheetToggle.textContent = sheet.open
    ? 'Close Bottom Sheet'
    : 'Open Bottom Sheet';
});
sheet?.addEventListener('mdClose', () => {
  if (!sheet) return;
  sheet.open = false;
  if (sheetToggle) sheetToggle.textContent = 'Open Bottom Sheet';
});
