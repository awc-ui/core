import React, { useCallback, useState } from 'react';
import { useGlobals } from 'storybook/manager-api';
import {
  DEFAULT_FONT,
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  DEFAULT_TERTIARY,
  FONT_OPTIONS,
} from './constants.ts';

type ColorKey = 'primaryColor' | 'secondaryColor' | 'tertiaryColor';

const COLOR_DEFAULTS: Record<ColorKey, string> = {
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  tertiaryColor: DEFAULT_TERTIARY,
};

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
  }
  return fallback;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: 1.4,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '72px 40px 1fr',
    alignItems: 'center',
    gap: '10px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
  },
  colorInput: {
    inlineSize: '40px',
    blockSize: '32px',
    padding: 0,
    border: '1px solid rgba(128, 128, 128, 0.35)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
  },
  hexInput: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    inlineSize: '100%',
    boxSizing: 'border-box',
  },
  select: {
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    inlineSize: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    margin: 0,
    fontSize: '11px',
    opacity: 0.65,
  },
  resetButton: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
};

type ColorRowProps = {
  label: string;
  globalKey: ColorKey;
  value: string;
  onChange: (key: ColorKey, hex: string) => void;
};

function ColorRow({ label, globalKey, value, onChange }: ColorRowProps) {
  const [draft, setDraft] = useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = useCallback(() => {
    const normalized = normalizeHex(draft, COLOR_DEFAULTS[globalKey]);
    setDraft(normalized);
    onChange(globalKey, normalized);
  }, [draft, globalKey, onChange]);

  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(globalKey, event.target.value.toUpperCase())}
        style={styles.colorInput}
        aria-label={`${label} color picker`}
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft();
          }
        }}
        style={styles.hexInput}
        aria-label={`${label} hex value`}
        spellCheck={false}
      />
    </div>
  );
}

export function ThemePanel() {
  const [globals, updateGlobals] = useGlobals();

  const primary = normalizeHex(globals.primaryColor as string | undefined, DEFAULT_PRIMARY);
  const secondary = normalizeHex(globals.secondaryColor as string | undefined, DEFAULT_SECONDARY);
  const tertiary = normalizeHex(globals.tertiaryColor as string | undefined, DEFAULT_TERTIARY);
  const fontFamily = (globals.fontFamily as string | undefined)?.trim() || DEFAULT_FONT;

  const setColor = useCallback(
    (key: ColorKey, hex: string) => {
      updateGlobals({ [key]: normalizeHex(hex, COLOR_DEFAULTS[key]) });
    },
    [updateGlobals],
  );

  const resetToDefaults = useCallback(() => {
    updateGlobals({
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      tertiaryColor: DEFAULT_TERTIARY,
      fontFamily: DEFAULT_FONT,
      theme: 'light',
    });
  }, [updateGlobals]);

  return (
    <div style={styles.root}>
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Seed colors</h3>
        <p style={styles.hint}>MD3 roles are generated from these three seed colors.</p>
        <ColorRow label="Primary" globalKey="primaryColor" value={primary} onChange={setColor} />
        <ColorRow
          label="Secondary"
          globalKey="secondaryColor"
          value={secondary}
          onChange={setColor}
        />
        <ColorRow label="Tertiary" globalKey="tertiaryColor" value={tertiary} onChange={setColor} />
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Typography</h3>
        <label htmlFor="theme-font-family" style={styles.label}>
          Font family
        </label>
        <select
          id="theme-font-family"
          value={fontFamily}
          onChange={(event) => updateGlobals({ fontFamily: event.target.value })}
          style={styles.select}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </section>

      <button type="button" onClick={resetToDefaults} style={styles.resetButton}>
        Reset to defaults
      </button>
    </div>
  );
}
