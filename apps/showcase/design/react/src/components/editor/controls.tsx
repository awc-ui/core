import { useT as usePictorT } from '@/lib/showcase';
import { useEffect, useState, type ReactNode } from 'react';
import { useCustomEvent, useElementProps } from '@/components/elements';

export function TextControl({ value, onValue, live = false, label, placeholder, ...props }: { value: string; onValue(value: string): void; live?: boolean; label?: string; placeholder?: string; [key: string]: unknown }) {
  const ref = useElementProps({ value }, [value]);
  useCustomEvent<CustomEvent<string>>(ref, live ? 'mdInput' : 'mdChange', event => onValue(String(event.detail ?? '')));
  return <md-text-field ref={ref} value={value} label={label} placeholder={placeholder} variant="outlined" density={-2} {...props} />;
}

export function NumberControl({ value, onValue, label, min = 0, max = 48, ...props }: { value: number | null; onValue(value: number): void; label: string; min?: number; max?: number; [key: string]: unknown }) {
  const p = usePictorT();
  const ref = useElementProps({ value }, [value]);
  useCustomEvent<CustomEvent<{ value: number | null }>>(ref, 'mdChange', event => {
    const value = event.detail?.value;
    if (typeof value === 'number' && Number.isFinite(value)) onValue(value);
  });
  return <md-number-field locale={p.locale === 'ar' ? 'ar-u-nu-arab' : p.locale} value-missing-label={p("Please enter a number.")} increment-label={p("Increment")} decrement-label={p("Decrement")} ref={ref} value={value ?? undefined} label={label} placeholder={value === null ? p("Mixed") : undefined} min={min} max={max} step={1} variant="outlined" density={-2} steppers="none" {...props} />;
}

export function SelectControl({ value, onValue, label, options, ...props }: { value: string; onValue(value: string): void; label: string; options: readonly { value: string; label: string }[]; [key: string]: unknown }) {
  const ref = useElementProps({ value }, [value]);
  useCustomEvent<CustomEvent<string>>(ref, 'mdChange', event => onValue(String(event.detail)));
  return <md-select ref={ref} value={value} label={label} variant="outlined" density={-2} {...props}>{options.map(option => <md-select-option key={option.value} value={option.value} label={option.label} />)}</md-select>;
}

export function ChoiceTabs({ value, onValue, options, label }: { value: string; onValue(value: string): void; options: readonly { value: string; label: string; icon?: string }[]; label: string }) {
  const ref = useElementProps({}, []);
  useCustomEvent<CustomEvent<string[]>>(ref, 'mdChange', event => { if (event.detail[0]) onValue(event.detail[0]); });
  return <md-segmented-button-set ref={ref} class="studio-segments" aria-label={label} density={-2}>{options.map(option => <md-segmented-button key={option.value} value={option.value} label={option.label} icon={option.icon} selected={value === option.value || undefined} />)}</md-segmented-button-set>;
}

/** Panel navigation uses tabs, leaving room for labels without selection glyphs. */
export function PanelTabs({ value, onValue, options, label }: { value: string; onValue(value: string): void; options: readonly { value: string; label: string; icon?: string }[]; label: string }) {
  const activeTabIndex = Math.max(0, options.findIndex(option => option.value === value));
  const ref = useElementProps({ activeTabIndex }, [activeTabIndex]);
  useCustomEvent<CustomEvent<{ index: number }>>(ref, 'mdTabChange', event => {
    if (event.target !== ref.current) return;
    const option = options[event.detail.index];
    if (option) onValue(option.value);
  });
  return <md-tabs ref={ref} class="studio-panel-tabs" aria-label={label} variant="secondary" tab-width="equal">{options.map(option => <md-tab key={option.value} label={option.label} active={value === option.value || undefined} density={0} />)}</md-tabs>;
}

export function RangeControl({ value, onValue, label, min = 0, max = 100, step = 5 }: { value: number; onValue(value: number): void; label: string; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const ref = useElementProps({ value: draft }, [draft]);
  const read = (event: CustomEvent) => Number(typeof event.detail === 'number' ? event.detail : event.detail?.value);
  useCustomEvent<CustomEvent>(ref, 'mdInput', event => { if (Number.isFinite(read(event))) setDraft(read(event)); });
  useCustomEvent<CustomEvent>(ref, 'mdChange', event => { if (Number.isFinite(read(event))) { setDraft(read(event)); onValue(read(event)); } });
  return <div className="studio-range"><div><span>{label}</span><strong>{draft}{min === 0 && max === 100 ? '%' : ''}</strong></div><md-slider ref={ref} min={min} max={max} value={draft} step={step} aria-label={label} value-indicator /></div>;
}

export function ToggleControl({ selected, onValue, label }: { selected: boolean; onValue(value: boolean): void; label: string }) {
  const ref = useElementProps({ selected }, [selected]);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(ref, 'mdChange', event => onValue(event.detail.selected));
  return <label className="studio-toggle"><span>{label}</span><md-switch ref={ref} selected={selected || undefined} aria-label={label} /></label>;
}

export function StudioDialog({ open, onClose, title, children, actions, fullscreen = false }: { open: boolean; onClose(): void; title: string; children: ReactNode; actions?: ReactNode; fullscreen?: boolean }) {
  const p = usePictorT();
  const ref = useElementProps({ open }, [open]);
  const closeOwnDialog = (event: CustomEvent) => { if (event.target === ref.current) onClose(); };
  useCustomEvent<CustomEvent>(ref, 'mdClose', closeOwnDialog);
  useCustomEvent<CustomEvent>(ref, 'mdCancel', closeOwnDialog);
  if (!open) return null;
  return <md-dialog ref={ref} class="studio-dialog" open={open || undefined} headline={title} fullscreen={fullscreen || undefined} close-label={p("Close dialog")} locale={p.locale}><div className="studio-dialog__content">{children}</div>{actions ? <div slot="actions" className="studio-dialog__actions">{actions}</div> : null}</md-dialog>;
}

export function ColorControl({ value, onValue }: { value: string; onValue(value: string): void }) {
  const p = usePictorT();
  const ref = useElementProps({ value }, [value]);
  useCustomEvent<CustomEvent<{ value: string }>>(ref, 'mdChange', event => onValue(event.detail.value));
  return <md-color-picker locale={p.locale} ref={ref} value={value} variant="popup" aria-label={p("Custom fill color")} show-hex presets="#203D35,#BEE7AA,#F4F1E9,#F2AAA7,#392263,#C2BBF3" />;
}

/** The workspace file filters use AWC's required single-selection button group. */
export function FileFilterGroup({ value, onValue, options, label }: { value: string; onValue(value: string): void; options: readonly { value: string; label: string; icon?: string }[]; label: string }) {
  const ref = useElementProps({ selectionMode: 'single-select', required: true }, []);
  useCustomEvent<CustomEvent<{ values: string[] }>>(ref, 'mdSelectionChange', event => {
    if (event.target !== ref.current) return;
    const next = event.detail.values[0];
    if (options.some(option => option.value === next)) onValue(next);
  });
  return <md-button-group ref={ref} variant="standard" selection-mode="single-select" required aria-label={label} size="sm" density={-2}>{options.map(option => <md-button key={option.value} variant="tonal" toggle value={option.value} icon={option.icon} selected={value === option.value || undefined} aria-pressed={value === option.value}>{option.label}</md-button>)}</md-button-group>;
}
