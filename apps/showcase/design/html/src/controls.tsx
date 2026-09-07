import { translateUi as p } from './context';
import { dom, Fragment } from './dom';
import { getRouter, getTranslator, withBase } from './context';
import { crumbsFor } from '@awc-ui/showcase-kit/design';
const event = (element: HTMLElement, name: string, callback: (event: CustomEvent) => void) => {
  element.addEventListener(name, ((value: CustomEvent) => { if (value.target === element) callback(value); }) as EventListener);
  return element;
};
export function TextControl({ value, onValue, live = false, ...props }: any) {
  return event(<md-text-field {...props} value={value} variant="outlined" density={-2} />, live ? 'mdInput' : 'mdChange', e => onValue(String(e.detail ?? '')));
}
export function NumberControl({ value, onValue, min = 0, max = 48, ...props }: any) {
  return event(<md-number-field locale={getTranslator().locale === 'ar' ? 'ar-u-nu-arab' : getTranslator().locale} value-missing-label={p("Please enter a number.")} increment-label={p("Increment")} decrement-label={p("Decrement")} {...props} value={value ?? undefined} placeholder={value === null ? p("Mixed") : undefined} min={min} max={max} step={props.step ?? 1} variant="outlined" density={-2} steppers="none" />, 'mdChange', e => { if (typeof e.detail?.value === 'number' && Number.isFinite(e.detail.value)) onValue(e.detail.value); });
}
export function SelectControl({ value, onValue, options, ...props }: any) {
  return event(<md-select {...props} value={value} variant="outlined" density={-2}>{options.map((o: any) => <md-select-option value={o.value} label={o.label} />)}</md-select>, 'mdChange', e => onValue(String(e.detail)));
}
export function ChoiceTabs({ value, onValue, options, label }: any) {
  return event(<md-segmented-button-set class="studio-segments" aria-label={label} density={-2}>{options.map((o: any) => <md-segmented-button value={o.value} label={o.label} icon={o.icon} selected={o.value === value || undefined} />)}</md-segmented-button-set>, 'mdChange', e => { if (e.detail[0]) onValue(e.detail[0]); });
}
export function PanelTabs({ value, onValue, options, label }: any) {
  return event(<md-tabs class="studio-panel-tabs" aria-label={label} variant="secondary" tab-width="equal" activeTabIndex={Math.max(0, options.findIndex((o: any) => o.value === value))}>{options.map((o: any) => <md-tab label={o.label} active={o.value === value || undefined} density={0} />)}</md-tabs>, 'mdTabChange', e => { if (options[e.detail.index]) onValue(options[e.detail.index].value); });
}
export function RangeControl({ value, onValue, label, min = 0, max = 100, step = 5 }: any) {
  const output = <strong>{value}{min === 0 && max === 100 ? '%' : ''}</strong>;
  const slider = <md-slider min={min} max={max} step={step} value={value} aria-label={label} value-indicator />;
  const read = (e: CustomEvent) => Number(typeof e.detail === 'number' ? e.detail : e.detail?.value);
  event(slider, 'mdInput', e => { if (Number.isFinite(read(e))) output.textContent = String(read(e)) + (min === 0 && max === 100 ? '%' : ''); });
  event(slider, 'mdChange', e => { if (Number.isFinite(read(e))) onValue(read(e)); });
  return <div class="studio-range"><div><span>{label}</span>{output}</div>{slider}</div>;
}
export function ToggleControl({ selected, onValue, label }: any) {
  const toggle = event(<md-switch selected={selected || undefined} aria-label={label} />, 'mdChange', e => onValue(e.detail.selected));
  return <label class="studio-toggle"><span>{label}</span>{toggle}</label>;
}
export function ColorControl({ value, onValue }: any) {
  return event(<md-color-picker locale={getTranslator().locale} value={value} variant="popup" aria-label={p("Custom fill color")} show-hex presets="#203D35,#BEE7AA,#F4F1E9,#F2AAA7,#392263,#C2BBF3" />, 'mdChange', e => onValue(e.detail.value));
}
export function StudioDialog({ open, onClose, title, children, actions, fullscreen = false }: any) {
  if (!open) return null;
  const dialog = <md-dialog class="studio-dialog" open headline={title} fullscreen={fullscreen || undefined} close-label={p("Close dialog")} locale={getTranslator().locale}><div class="studio-dialog__content">{children}</div>{actions ? <div slot="actions" class="studio-dialog__actions">{actions}</div> : null}</md-dialog>;
  event(dialog, 'mdClose', onClose); event(dialog, 'mdCancel', onClose);
  return dialog;
}
export function Link({ href, children, ...props }: any) {
  return <a {...props} href={withBase(href)} onClick={(e: MouseEvent) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); getRouter().push(href); }}>{children}</a>;
}
export function Screen({ title, subtitle, aside, crumbLabel, children }: any) {
  const t = getTranslator();
  const crumbs = crumbsFor(getRouter().pathname, crumbLabel ?? null);
  const trail = crumbs.length ? <md-breadcrumbs label={t('design.nav.breadcrumb')} max-items="4" items-before-collapse="1" items-after-collapse="2">{crumbs.map((crumb, index) => <md-breadcrumb-item href={crumb.href && index < crumbs.length - 1 ? withBase(crumb.href) : undefined}>{crumb.labelKey ? t(crumb.labelKey) : crumb.label}</md-breadcrumb-item>)}</md-breadcrumbs> : null;
  if (trail) event(trail, 'mdSelect', e => {
    const { href, originalEvent } = e.detail ?? {};
    if (!href || originalEvent?.metaKey || originalEvent?.ctrlKey || originalEvent?.shiftKey || originalEvent?.altKey) return;
    e.preventDefault(); getRouter().push(href.replace(withBase(''), '') || '/');
  });
  return <><div class="shell__trail">{trail}</div><div class="screen-head"><div class="screen-head__text"><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{aside ? <div class="screen-head__aside">{aside}</div> : null}</div><div class="screen-stage"><div class="screen-body">{children}</div></div></>;
}

/** The workspace file filters use AWC's required single-selection button group. */
export function FileFilterGroup({ value, onValue, options, label }: any) {
  return event(<md-button-group variant="standard" selection-mode="single-select" required aria-label={label} size="sm" density={-2}>{options.map((option:any) => <md-button variant="tonal" toggle value={option.value} icon={option.icon} selected={value===option.value} aria-pressed={value===option.value}>{option.label}</md-button>)}</md-button-group>, 'mdSelectionChange', (event:CustomEvent<{values:string[]}>) => {
    const next=event.detail.values[0]; if(options.some((option:any)=>option.value===next))onValue(next);
  });
}
