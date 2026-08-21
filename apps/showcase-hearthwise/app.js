/* Hearthwise — interaction layer. Plain ES module, no build step. */

/* ---------- Section navigation (footer md-navigation-bar) ---------- */

const sections = document.querySelectorAll('[data-section]');
const nav = document.getElementById('main-nav');

nav.addEventListener('mdChange', (e) => {
  const { index } = e.detail;
  sections.forEach((section, i) => {
    section.hidden = i !== index;
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
});

/* ---------- Room grid: power switches ---------- */

document.querySelectorAll('md-switch[data-power]').forEach((sw) => {
  sw.addEventListener('mdChange', (e) => {
    const label = sw.closest('.device-card__toggle').querySelector('[data-power-label]');
    label.textContent = e.detail.selected ? 'On' : 'Off';
  });
});

/* ---------- Lighting sliders: live readouts ---------- */

document.querySelectorAll('md-slider[data-zone]').forEach((slider) => {
  const key = `${slider.dataset.zone}-${slider.dataset.kind}`;
  const readout = document.querySelector(`[data-readout="${key}"]`);
  slider.addEventListener('mdInput', (e) => {
    const v = e.detail.value;
    readout.textContent = slider.dataset.kind === 'warmth' ? `${v} K` : `${v}%`;
  });
});

/* ---------- Ambience: retint the MD3 colour roles from the picker ---------- */

function hexToHsl(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

function applyAccent(hex) {
  const { h, s } = hexToHsl(hex);
  const root = document.documentElement.style;
  const sat = Math.min(s, 90);

  /* Manual MD3-role mapping derived from the picked hue. */
  root.setProperty('--md-sys-color-primary', hsl(h, sat, 40));
  root.setProperty('--md-sys-color-on-primary', hsl(h, sat, 98));
  root.setProperty('--md-sys-color-primary-container', hsl(h, Math.round(sat * 0.85), 90));
  root.setProperty('--md-sys-color-on-primary-container', hsl(h, sat, 12));
  root.setProperty('--md-sys-color-secondary', hsl(h, Math.round(sat * 0.35), 38));
  root.setProperty('--md-sys-color-secondary-container', hsl(h, Math.round(sat * 0.4), 88));
  root.setProperty('--md-sys-color-on-secondary-container', hsl(h, Math.round(sat * 0.5), 12));
}

const picker = document.getElementById('accent-picker');
picker.addEventListener('mdInput', (e) => applyAccent(e.detail.value));
picker.addEventListener('mdChange', (e) => applyAccent(e.detail.value));

const sceneHint = document.getElementById('scene-hint');
document.getElementById('scene-apply').addEventListener('click', () => {
  sceneHint.textContent = `Evening scene saved with accent ${picker.value}.`;
});

/* ---------- Energy sparklines: data is a JS-only property ---------- */

const sparkTotal = document.getElementById('spark-total');
sparkTotal.data = [8.2, 7.9, 9.4, 10.1, 8.8, 7.2, 6.9, 8.5, 9.0, 10.6, 9.7, 8.1, 7.6, 7.4];
sparkTotal.labels = [
  'Aug 9', 'Aug 10', 'Aug 11', 'Aug 12', 'Aug 13', 'Aug 14', 'Aug 15',
  'Aug 16', 'Aug 17', 'Aug 18', 'Aug 19', 'Aug 20', 'Aug 21', 'Aug 22',
];
sparkTotal.valueFormatter = (v) => `${v ?? 0} kWh`;

const sparkHeating = document.getElementById('spark-heating');
sparkHeating.data = [4.6, 4.2, 5.1, 5.8, 4.9, 3.7, 3.5, 4.4, 4.8, 6.0, 5.3, 4.3, 4.0, 4.1];
sparkHeating.valueFormatter = (v) => `${v ?? 0} kWh`;

const sparkLighting = document.getElementById('spark-lighting');
sparkLighting.data = [1.1, 1.0, 1.3, 1.4, 1.2, 1.0, 0.9, 1.2, 1.3, 1.5, 1.4, 1.1, 1.0, 1.2];
sparkLighting.valueFormatter = (v) => `${v ?? 0} kWh`;

/* ---------- Device settings bottom sheet ---------- */

const sheet = document.getElementById('device-sheet');
const sheetRoom = document.getElementById('sheet-room');

document.querySelectorAll('md-icon-button[data-device]').forEach((btn) => {
  btn.addEventListener('click', () => {
    sheet.headline = `${btn.dataset.device}`;
    sheetRoom.textContent = `${btn.dataset.room} — applies on the next power-on`;
    sheet.show();
  });
});

document.getElementById('sheet-cancel').addEventListener('click', () => sheet.close());
document.getElementById('sheet-save').addEventListener('click', () => sheet.close());
