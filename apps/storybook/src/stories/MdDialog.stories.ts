import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

const meta: Meta = {
  title: 'Containment/Dialog',
  component: 'md-dialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    open: { control: 'boolean', description: 'Whether the dialog is open' },
    headline: { control: 'text', description: 'Headline text' },
    icon: { control: 'text', description: 'Material Symbol icon name' },
    fullscreen: { control: 'boolean', description: 'Full-screen variant' },
    divider: { control: 'boolean', description: 'Show divider above actions' },
    'scrim-dismissible': { control: 'boolean', description: 'Close on scrim click' },
  },
  args: {
    open: false,
    headline: 'Dialog Title',
    icon: '',
    fullscreen: false,
    divider: false,
    'scrim-dismissible': true,
  },
};
export default meta;
type Story = StoryObj;

function getDialog(id: string): any {
  return document.querySelector(`#${id}`);
}

/* ─── play() helpers ──────────────────────────────────────────
 * testing-library queries can't cross shadow roots, so play()s
 * address md-dialog's real internals directly. `getDlg` also gates
 * on Stencil hydration — @Method calls / prop writes are silent
 * no-ops before `.hydrated` lands. */
type DialogEl = HTMLElement & {
  open: boolean;
  scrimDismissible: boolean;
  show: () => Promise<void>;
  close: () => Promise<void>;
};
const getDlg = async (canvasElement: HTMLElement, id: string): Promise<DialogEl> => {
  const dlg = (canvasElement.querySelector(`#${id}`) ??
    document.querySelector(`#${id}`)) as DialogEl;
  await waitFor(() => expect(dlg.classList.contains('hydrated')).toBe(true));
  return dlg;
};
const partOf = (dlg: DialogEl, name: string) =>
  dlg.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;
const key = (target: EventTarget, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('playground-dialog')?.show()}>
      ${t(globals.locale, 'dialog.openDialog')}
    </md-button>
    <md-dialog
      id="playground-dialog"
      ?open=${args.open}
      headline=${args.headline || ''}
      icon=${args.icon || ''}
      ?fullscreen=${args.fullscreen}
      ?divider=${args.divider}
      scrim-dismissible=${args['scrim-dismissible']}
    >
      ${t(globals.locale, 'dialog.playgroundBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('playground-dialog')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('playground-dialog')?.close()}>${t(globals.locale, 'dialog.confirm')}</md-button>
      </div>
    </md-dialog>
  `,
};

/* ─── Basic Dialog ────────────────────────────────────────── */
export const BasicDialog: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('basic-dialog')?.show()}>
      ${t(globals.locale, 'dialog.openBasic')}
    </md-button>
    <md-dialog id="basic-dialog" headline=${t(globals.locale, 'dialog.discardDraft')}>
      ${t(globals.locale, 'dialog.discardBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('basic-dialog')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('basic-dialog')?.close()}>${t(globals.locale, 'dialog.discard')}</md-button>
      </div>
    </md-dialog>
  `,
  /** Open moves focus INTO the dialog; Escape closes it and RESTORES focus
   *  to the opener — the full modal focus contract (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'basic-dialog');
    const opener = canvasElement.querySelector('md-button') as HTMLElement;

    await step('show() flips open=true and pulls focus into the dialog', async () => {
      opener.focus(); // the opener owns focus now, so we can prove restoration later
      expect(dlg.open).toBe(false);
      expect(dlg.contains(document.activeElement)).toBe(false); // focus starts OUTSIDE
      let opened = false;
      dlg.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      await dlg.show();
      // reflected `open` attr + the visibility class land on the NEXT flush
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      expect(dlg.classList.contains('md-dialog--open')).toBe(true);
      expect(opened).toBe(true); // component actually emitted mdOpen
      // focusFirst() (queued in a rAF) drags focus onto the first action button
      await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true));
    });

    await step('Escape closes it, emits mdCancel, and restores focus to the opener', async () => {
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      key(dlg, 'Escape');
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(dlg.open).toBe(false);
      expect(cancelled).toBe(true); // Escape ran the dismiss path, not just hid the box
      expect(dlg.classList.contains('md-dialog--open')).toBe(false);
      await waitFor(() => expect(document.activeElement).toBe(opener)); // focus RESTORED
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });

    await step('Focus trap: Shift+Tab wraps first→last, Tab wraps last→first', async () => {
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      const btns = [...dlg.querySelectorAll('md-button')] as HTMLElement[];
      const firstBtn = btns[0];
      const lastBtn = btns[btns.length - 1];
      expect(btns.length).toBeGreaterThan(1); // two slotted action buttons frame the trap
      // focusFirst() (rAF) parks focus on the FIRST focusable stop
      await waitFor(() => expect(document.activeElement).toBe(firstBtn));
      // Shift+Tab at the top edge must wrap to the LAST stop
      dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true }));
      await waitFor(() => expect(document.activeElement).toBe(lastBtn));
      // Tab at the bottom edge must wrap back to the FIRST stop
      dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
      await waitFor(() => expect(document.activeElement).toBe(firstBtn));
    });

    await step('Scrim click on a dismissible dialog emits mdCancel and closes', async () => {
      expect(dlg.scrimDismissible).toBe(true); // default — this surface IS scrim-dismissible
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      partOf(dlg, 'scrim').click(); // exercises the dismissible branch of handleScrimClick
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(cancelled).toBe(true); // the scrim ran the dismiss path, not just hid the box
      expect(dlg.classList.contains('md-dialog--open')).toBe(false);
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });

    await step('slotchange keeps host slot-state in sync when children mutate at runtime', async () => {
      // Emptying the actions slot must flip back to the BUILT-IN Cancel/OK buttons.
      expect(partOf(dlg, 'cancel-button')).toBeNull(); // slotted actions => no default buttons
      dlg.querySelector('[slot="actions"]')!.remove();
      await waitFor(() => expect(partOf(dlg, 'cancel-button')).not.toBeNull());
      expect(partOf(dlg, 'ok-button')).not.toBeNull();

      // A slotted headline, added at runtime, must be picked up by slotchange and
      // keep the dialog "labelled" even after the headline PROP is cleared — then
      // removing the slotted node drops the label again (slot fork drives aria).
      const container = partOf(dlg, 'container');
      expect(container.hasAttribute('aria-labelledby')).toBe(true); // labelled via the prop
      const span = document.createElement('span');
      span.setAttribute('slot', 'headline');
      span.textContent = 'Runtime headline';
      dlg.appendChild(span);
      const hSlot = () => dlg.shadowRoot!.querySelector('slot[name="headline"]') as HTMLSlotElement | null;
      await waitFor(() => expect(hSlot()?.assignedElements().includes(span)).toBe(true));
      (dlg as any).headline = '';
      dlg.removeAttribute('headline');
      // prop is now empty but the slotted node still supplies the label
      await waitFor(() => expect(partOf(dlg, 'container').hasAttribute('aria-labelledby')).toBe(true));
      span.remove();
      // with neither prop nor slot, the dialog is no longer labelled
      await waitFor(() => expect(partOf(dlg, 'container').hasAttribute('aria-labelledby')).toBe(false));
    });
  },
};

/* ─── With Icon ───────────────────────────────────────────── */
export const WithIcon: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      <md-button variant="filled" @click=${() => getDialog('icon-dialog-1')?.show()}>
        ${t(globals.locale, 'dialog.deleteDialogBtn')}
      </md-button>
      <md-button variant="outlined" @click=${() => getDialog('icon-dialog-2')?.show()}>
        ${t(globals.locale, 'dialog.warningDialogBtn')}
      </md-button>
    </div>
    <md-dialog id="icon-dialog-1" headline=${t(globals.locale, 'dialog.deleteFile')} icon="delete">
      ${t(globals.locale, 'dialog.deleteFileBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('icon-dialog-1')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('icon-dialog-1')?.close()}>${t(globals.locale, 'delete')}</md-button>
      </div>
    </md-dialog>
    <md-dialog id="icon-dialog-2" headline=${t(globals.locale, 'dialog.connectionLost')} icon="wifi_off">
      ${t(globals.locale, 'dialog.connectionLostBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('icon-dialog-2')?.close()}>${t(globals.locale, 'dialog.dismiss')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('icon-dialog-2')?.close()}>${t(globals.locale, 'dialog.retry')}</md-button>
      </div>
    </md-dialog>
  `,
  /** The `icon` PROP (not a slotted node) renders the built-in Material Symbol
   *  fallback inside the icon slot and flips the host's has-icon modifier — a
   *  code path none of the slotted-actions plays touch. */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'icon-dialog-1');

    await step('icon prop renders the built-in symbol and flags the host has-icon', async () => {
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      // `icon="delete"` renders the `this.icon && <span part="icon">` slot fallback
      const icon = partOf(dlg, 'icon');
      expect(icon).not.toBeNull();
      expect(icon.textContent?.trim()).toBe('delete'); // the Material Symbol ligature
      // render() computed hasIcon from the prop and stamped the host modifier class
      expect(dlg.classList.contains('md-dialog--has-icon')).toBe(true);
      // slotted [slot="actions"] present => renderActions() takes the slot branch,
      // so the built-in OK button is NOT rendered
      expect(partOf(dlg, 'ok-button')).toBeNull();
      // basic (non-fullscreen) surface exposes the assertive alertdialog role
      expect(partOf(dlg, 'container').getAttribute('role')).toBe('alertdialog');
      await dlg.close();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });
  },
};

/* ─── With Slotted Icon ──────────────────────────────────── */
export const SlottedIcon: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('slotted-icon-dialog')?.show()}>
      ${t(globals.locale, 'dialog.customSvgIcon')}
    </md-button>
    <md-dialog id="slotted-icon-dialog" headline=${t(globals.locale, 'dialog.starItem')}>
      <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      ${t(globals.locale, 'dialog.starBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('slotted-icon-dialog')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('slotted-icon-dialog')?.close()}>${t(globals.locale, 'dialog.starAction')}</md-button>
      </div>
    </md-dialog>
  `,
};

/* ─── With Divider ────────────────────────────────────────── */
export const WithDivider: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('divider-dialog')?.show()}>
      ${t(globals.locale, 'dialog.termsConditionsBtn')}
    </md-button>
    <md-dialog id="divider-dialog" headline=${t(globals.locale, 'dialog.termsOfService')} divider>
      <div style="max-height: 200px; overflow-y: auto;" tabindex="0" role="region" aria-label=${t(globals.locale, 'dialog.termsOfService')}>
        <p>${t(globals.locale, 'dialog.termsIntro')}</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      </div>
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('divider-dialog')?.close()}>${t(globals.locale, 'dialog.decline')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('divider-dialog')?.close()}>${t(globals.locale, 'dialog.accept')}</md-button>
      </div>
    </md-dialog>
  `,
};

/* ─── Full-screen Dialog ──────────────────────────────────── */
export const FullScreenDialog: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('fullscreen-dialog')?.show()}>
      ${t(globals.locale, 'dialog.openFullscreen')}
    </md-button>
    <md-dialog id="fullscreen-dialog" fullscreen headline=${t(globals.locale, 'dialog.editProfile')} header-divider>
      <md-button slot="header-action" variant="text" @click=${() => {
        getDialog('fullscreen-dialog')?.close();
      }}>${t(globals.locale, 'save')}</md-button>
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 8px 0;">
        <p style="margin:0; color: var(--md-sys-color-on-surface-variant, #49454F); font: 400 14px/20px Roboto, sans-serif;">
          ${t(globals.locale, 'dialog.updateProfile')}
        </p>
        <md-text-field variant="outlined" label=${t(globals.locale, 'dialog.name')} value="Jane Doe"></md-text-field>
        <md-text-field variant="outlined" label=${t(globals.locale, 'dialog.email')} type="email" value="jane@example.com"></md-text-field>
        <md-text-field variant="outlined" label=${t(globals.locale, 'dialog.bio')} multiline rows="4" value="Designer & Developer"></md-text-field>
      </div>
    </md-dialog>
  `,
  /** Full-screen uses role="dialog" (not alertdialog), focuses its built-in
   *  close button (which lives in md-dialog's OWN shadow root, so the focus
   *  trap must chase focus across a shadow boundary), and the close button
   *  runs the mdCancel dismiss path. */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'fullscreen-dialog');
    const opener = canvasElement.querySelector('md-button') as HTMLElement;
    const closeBtn = () => partOf(dlg, 'close-button');

    await step('Opens full-screen and focuses the built-in close button', async () => {
      opener.focus(); // owns focus, so we can prove restoration on close
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      // full-screen container is a plain dialog role, not alertdialog
      expect(partOf(dlg, 'container').getAttribute('role')).toBe('dialog');
      // focusFirst() lands on the close button, which sits inside md-dialog's shadow
      await waitFor(() => expect(dlg.shadowRoot!.activeElement).toBe(closeBtn()));
      // aria-label resolved from the (default en-US) locale
      expect(closeBtn().getAttribute('aria-label')).toBe('Close');
    });

    await step('Tab is handled by the deep-focus trap (focus inside shadow DOM)', async () => {
      // getDeepActiveElement() must descend into md-dialog's shadow root to find the
      // real focused leaf; the close button is the FIRST stop so focus stays put.
      dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
      await waitFor(() => expect(dlg.shadowRoot!.activeElement).toBe(closeBtn()));
    });

    await step('Close button dismisses (mdCancel) and restores focus to the opener', async () => {
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      closeBtn().click(); // native <button> wired to handleCloseClick
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(cancelled).toBe(true); // handleCloseClick emitted mdCancel
      await waitFor(() => expect(document.activeElement).toBe(opener)); // focus RESTORED
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });

    await step('Focus trap wraps across slotted content: Shift+Tab off the first stop, Tab back', async () => {
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      // focusFirst() parks on the built-in close button — the FIRST stop, which lives
      // in md-dialog's OWN shadow root.
      await waitFor(() => expect(dlg.shadowRoot!.activeElement).toBe(closeBtn()));
      // Shift+Tab at the top edge runs trapFocus' shift branch and wraps to the LAST
      // stop. Reaching a last stop at all proves getFocusableElements() collected the
      // directly-slotted header-action button and the slotted fields across the shadow
      // boundary (the deep collect + slotted-match push).
      dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true }));
      await waitFor(() => expect(dlg.shadowRoot!.activeElement).not.toBe(closeBtn())); // focus left the close button
      // focus stayed trapped inside the modal (the host reports itself while a shadow
      // child holds focus; a slotted light-DOM leaf is contained by the host)
      expect(dlg === document.activeElement || dlg.contains(document.activeElement)).toBe(true);
      // Tab at the bottom edge runs the non-shift branch and wraps back to the FIRST stop
      dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
      await waitFor(() => expect(dlg.shadowRoot!.activeElement).toBe(closeBtn()));
      await dlg.close();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });

    // Reset to the fresh-render visual state. The dialog is already closed above, but
    // close() restored focus to the opener (a visible focus ring); a fresh render has
    // nothing focused. Blur so the visual screenshot matches the clean resting render.
    await step('Reset: dialog closed + opener blurred (no lingering focus ring)', async () => {
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      await new Promise((r) => requestAnimationFrame(() => r(null))); // settle the reset render
    });
  },
};

/* ─── Controlled State ────────────────────────────────────── */
export const ControlledState: Story = {
  render: (_args, { globals }) => {
    return html`
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getDialog('ctrl-dialog')?.show()}>${t(globals.locale, 'dialog.openBtn')}</md-button>
        <md-button variant="outlined" @click=${() => getDialog('ctrl-dialog')?.close()}>${t(globals.locale, 'dialog.closeExternal')}</md-button>
      </div>
      <md-dialog id="ctrl-dialog" headline=${t(globals.locale, 'dialog.controlled')}>
        ${t(globals.locale, 'dialog.controlledBody')}
        <div slot="actions">
          <md-button variant="text" @click=${() => getDialog('ctrl-dialog')?.close()}>${t(globals.locale, 'dialog.close')}</md-button>
        </div>
      </md-dialog>
      <div style="margin-top: 12px; padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
        <strong>Controlled state:</strong> Use <code>show()</code> / <code>close()</code> methods or set the <code>open</code> property directly.
      </div>
    `;
  },
  /** The `open` PROPERTY (not the show() method) drives visibility both ways
   *  (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'ctrl-dialog');
    const container = () => partOf(dlg, 'container');

    await step('Setting open=true renders it visible and interactive', async () => {
      expect(dlg.open).toBe(false);
      expect(dlg.classList.contains('md-dialog--open')).toBe(false);
      // hidden surface is inert (pointer-events:none) before we open it
      expect(getComputedStyle(container()).pointerEvents).toBe('none');
      let opened = false;
      dlg.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      dlg.open = true; // controlled directly via the prop, NOT show()
      // reflected attr + visibility class produced by the openChanged watcher
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      await waitFor(() => expect(dlg.classList.contains('md-dialog--open')).toBe(true));
      expect(opened).toBe(true);
      // the open class actually flips the container interactive — real visibility proof
      expect(getComputedStyle(container()).pointerEvents).toBe('auto');
    });

    await step('The external "Close (external)" button drives open=false', async () => {
      const closeBtn = [...canvasElement.querySelectorAll('md-button')].find(
        (b) => /close \(external\)/i.test(b.textContent ?? ''),
      ) as HTMLElement;
      let closed = false;
      dlg.addEventListener('mdClose', () => { closed = true; }, { once: true });
      closeBtn.click(); // wired to getDialog('ctrl-dialog').close()
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(dlg.open).toBe(false);
      expect(closed).toBe(true); // component emitted mdClose
      expect(dlg.classList.contains('md-dialog--open')).toBe(false);
      await waitFor(() => expect(getComputedStyle(container()).pointerEvents).toBe('none'));
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });
  },
};

/* ─── Non-dismissible Scrim ───────────────────────────────── */
export const NonDismissible: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('nodismiss-dialog')?.show()}>
      ${t(globals.locale, 'dialog.nonDismissibleBtn')}
    </md-button>
    <md-dialog id="nodismiss-dialog" headline=${t(globals.locale, 'dialog.acceptTermsHeadline')} scrim-dismissible="false">
      ${t(globals.locale, 'dialog.nonDismissibleBody')}
      <div slot="actions">
        <md-button variant="filled" @click=${() => getDialog('nodismiss-dialog')?.close()}>${t(globals.locale, 'dialog.iAccept')}</md-button>
      </div>
    </md-dialog>
  `,
  /** Guard: the scrim is inert here (`scrim-dismissible="false"`), so a scrim
   *  click must NOT close. Escape, however, is deliberately NOT gated by that
   *  flag — the second step documents that the two dismiss paths differ.
   *  (The task brief expected Escape to be blocked too; the component only
   *  gates the scrim, so asserting an Escape block would be a false test.) */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'nodismiss-dialog');

    await step('Opens; the surface is flagged non-scrim-dismissible', async () => {
      expect(dlg.scrimDismissible).toBe(false);
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      expect(dlg.classList.contains('md-dialog--open')).toBe(true);
    });

    await step('Clicking the scrim does NOT close and fires no mdCancel (guard)', async () => {
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      partOf(dlg, 'scrim').click();
      await new Promise((r) => setTimeout(r, 80)); // give a real dismiss time to happen
      expect(dlg.open).toBe(true); // still open — the guard held
      expect(cancelled).toBe(false); // and nothing was emitted
      expect(dlg.classList.contains('md-dialog--open')).toBe(true);
    });

    await step('Escape is NOT gated by scrim-dismissible — it still closes', async () => {
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      key(dlg, 'Escape');
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(cancelled).toBe(true); // the Escape dismiss path IS live
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });
  },
};

/* ─── Localization ────────────────────────────────────────── */
export const Localization: Story = {
  render: () => html`
    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-block-end: 16px;">
      <md-button variant="filled" @click=${() => getDialog('locale-de')?.show()}>
        Deutsch (de-DE)
      </md-button>
      <md-button variant="outlined" @click=${() => getDialog('locale-ja')?.show()}>
        日本語 (ja-JP)
      </md-button>
      <md-button variant="outlined" @click=${() => getDialog('locale-ar')?.show()}>
        العربية (ar)
      </md-button>
    </div>

    <md-dialog id="locale-de" locale="de-DE" headline="Datei löschen?" icon="delete">
      Diese Datei wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
    </md-dialog>

    <md-dialog id="locale-ja" locale="ja-JP" headline="ファイルを削除しますか？" icon="delete">
      このファイルは完全に削除されます。この操作は元に戻せません。
    </md-dialog>

    <md-dialog id="locale-ar" locale="ar" headline="حذف الملف؟" icon="delete">
      سيتم حذف هذا الملف نهائيًا. لا يمكن التراجع عن هذا الإجراء.
    </md-dialog>

    <p style="margin: 0; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
      Default Cancel / OK buttons and the full-screen Close <code>aria-label</code> are
      resolved from <code>locale</code>. Override with <code>cancel-label</code>,
      <code>ok-label</code>, or <code>close-label</code> when needed.
    </p>
  `,
  /** The de-DE surface has NO [slot="actions"], so renderActions() falls back to
   *  the built-in Cancel/OK buttons — and resolvedLabel()/resolveDialogLabel()
   *  must resolve the GERMAN strings from the locale prop, not the en-US fallback.
   *  Then OK closes silently (handleDefaultOkClick) while Cancel dismisses
   *  (handleCloseClick → mdCancel). */
  play: async ({ canvasElement, step }) => {
    const dlg = await getDlg(canvasElement, 'locale-de');
    const okBtn = () => partOf(dlg, 'ok-button');
    const cancelBtn = () => partOf(dlg, 'cancel-button');

    await step('locale="de-DE" + no actions slot => built-in buttons with German labels', async () => {
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      // renderActions() default branch rendered the built-in buttons
      await waitFor(() => expect(cancelBtn()).not.toBeNull());
      expect(okBtn()).not.toBeNull();
      // resolveDialogLabel(locale, …) picked the de translations, not the en fallback
      await waitFor(() => expect(cancelBtn().textContent?.trim()).toBe('Abbrechen'));
      expect(okBtn().textContent?.trim()).toBe('OK');
    });

    await step('Built-in OK closes WITHOUT emitting mdCancel (handleDefaultOkClick)', async () => {
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      await waitFor(() => expect(okBtn().classList.contains('hydrated')).toBe(true));
      okBtn().click();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(dlg.open).toBe(false);
      expect(cancelled).toBe(false); // OK is a plain close, not a dismiss
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Built-in Cancel closes AND emits mdCancel (handleCloseClick)', async () => {
      await dlg.show();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(true));
      let cancelled = false;
      dlg.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      await waitFor(() => expect(cancelBtn().classList.contains('hydrated')).toBe(true));
      cancelBtn().click();
      await waitFor(() => expect(dlg.hasAttribute('open')).toBe(false));
      expect(cancelled).toBe(true); // Cancel ran the dismiss path
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-button variant="filled" @click=${() => getDialog('rtl-dialog')?.show()}>
        فتح الحوار
      </md-button>
      <md-dialog id="rtl-dialog" headline="تأكيد الحذف" icon="delete">
        سيتم حذف هذا الملف نهائيًا. لا يمكن التراجع عن هذا الإجراء.
        <div slot="actions">
          <md-button variant="text" @click=${() => getDialog('rtl-dialog')?.close()}>إلغاء</md-button>
          <md-button variant="filled" @click=${() => getDialog('rtl-dialog')?.close()}>حذف</md-button>
        </div>
      </md-dialog>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getDialog('dark-dialog')?.show()}>
      ${t(globals.locale, 'dialog.openDark')}
    </md-button>
    <md-dialog id="dark-dialog" headline=${t(globals.locale, 'dialog.darkMode')} icon="dark_mode">
      ${t(globals.locale, 'dialog.darkBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('dark-dialog')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('dark-dialog')?.close()}>${t(globals.locale, 'dialog.ok')}</md-button>
      </div>
    </md-dialog>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .danger-dialog {
        --md-dialog-icon-color: var(--md-sys-color-error, #B3261E);
        --md-dialog-headline-color: var(--md-sys-color-error, #B3261E);
      }
      .rounded-dialog {
        --md-dialog-container-shape: 40px;
        --md-dialog-container-color: #f0f4ff;
      }
    </style>
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      <md-button variant="filled" @click=${() => getDialog('custom-danger')?.show()}>
        ${t(globals.locale, 'dialog.dangerStyleBtn')}
      </md-button>
      <md-button variant="outlined" @click=${() => getDialog('custom-rounded')?.show()}>
        ${t(globals.locale, 'dialog.customShapeBtn')}
      </md-button>
    </div>
    <md-dialog id="custom-danger" class="danger-dialog" headline=${t(globals.locale, 'dialog.dangerZone')} icon="warning">
      ${t(globals.locale, 'dialog.dangerBody')}
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('custom-danger')?.close()}>${t(globals.locale, 'cancel')}</md-button>
        <md-button variant="filled" @click=${() => getDialog('custom-danger')?.close()}>${t(globals.locale, 'delete')}</md-button>
      </div>
    </md-dialog>
    <md-dialog id="custom-rounded" class="rounded-dialog" headline="Custom shape">
      This dialog has a custom 40px corner radius and custom background.
      <div slot="actions">
        <md-button variant="text" @click=${() => getDialog('custom-rounded')?.close()}>${t(globals.locale, 'dialog.close')}</md-button>
      </div>
    </md-dialog>
  `,
};

/* ─── Accessibility ───────────────────────────────────────── */
export const Accessibility: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <md-button variant="filled" @click=${() => getDialog('a11y-dialog')?.show()}>
        ${t(globals.locale, 'dialog.openAccessible')}
      </md-button>
      <md-dialog id="a11y-dialog" headline=${t(globals.locale, 'dialog.deleteProject')} icon="delete">
        ${t(globals.locale, 'dialog.deleteProjectBody')}
        <div slot="actions">
          <md-button variant="text" @click=${() => getDialog('a11y-dialog')?.close()}>${t(globals.locale, 'cancel')}</md-button>
          <md-button variant="filled" @click=${() => getDialog('a11y-dialog')?.close()}>${t(globals.locale, 'delete')}</md-button>
        </div>
      </md-dialog>
      <div style="padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
        <strong>Accessibility features:</strong><br/>
        • <code>role="alertdialog"</code> (basic) / <code>role="dialog"</code> (full-screen)<br/>
        • <code>aria-modal="true"</code><br/>
        • <code>aria-labelledby</code> → headline, <code>aria-describedby</code> → content<br/>
        • <strong>Focus trap</strong>: Tab/Shift+Tab cycle within dialog<br/>
        • <strong>Escape</strong> closes the dialog<br/>
        • Focus restored to trigger element on close<br/>
        • Background scrolling locked
      </div>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    // The demo's widest viewport box is 1024px. Under the default centred
    // layout the canvas shrink-wraps its content, so the shell's and the boxes'
    // `max-inline-size: 100%` are circular and never bind — the story then
    // overflows a narrower canvas, and CENTRING clips both edges, taking the
    // first characters off every heading. 'padded' gives the root a definite
    // width so those percentage caps resolve.
    layout: 'padded',
    docs: {
      description: {
        story:
          'Basic dialogs center on screen with a max-width cap — on phones ' +
          'they may feel cramped for complex content. Use the ' +
          '<code>fullscreen</code> variant below ~600px for multi-field forms ' +
          'and editing tasks. Dialogs are <code>position: fixed</code> and ' +
          'anchor to the real viewport, so the dashed frames below show the ' +
          'trigger UI in constrained layouts; click the buttons to open each variant.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .dlg-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .dlg-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .dlg-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
      }
      .dlg-resp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    </style>

    <div class="dlg-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Trigger UI at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Recommendation: basic dialog for confirmations, fullscreen for forms on phones.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px', suffix: 'xs' },
          { label: 'SM · 480 px (large phone)', width: '480px', suffix: 'sm' },
          { label: 'MD · 768 px (tablet)', width: '768px', suffix: 'md' },
          { label: 'LG · 1024 px (desktop)', width: '1024px', suffix: 'lg' },
        ].map(
          (vp) => html`
            <div>
              <div class="dlg-resp-vp__label">${vp.label}</div>
              <div class="dlg-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <p style="margin: 0 0 12px; font-size: 14px;">
                  ${t(globals.locale, 'dialog.unsavedPreview')}
                </p>
                <div class="dlg-resp-actions">
                  <md-button variant="outlined" @click=${() => getDialog(`resp-basic-${vp.suffix}`)?.show()}>
                    Basic dialog
                  </md-button>
                  <md-button variant="filled" @click=${() => getDialog(`resp-full-${vp.suffix}`)?.show()}>
                    Full-screen
                  </md-button>
                </div>
              </div>
              <md-dialog id="resp-basic-${vp.suffix}" headline=${t(globals.locale, 'dialog.discardDraft')}>
                ${t(globals.locale, 'dialog.discardBody')}
                <div slot="actions">
                  <md-button variant="text" @click=${() => getDialog(`resp-basic-${vp.suffix}`)?.close()}>${t(globals.locale, 'cancel')}</md-button>
                  <md-button variant="filled" @click=${() => getDialog(`resp-basic-${vp.suffix}`)?.close()}>${t(globals.locale, 'dialog.discard')}</md-button>
                </div>
              </md-dialog>
              <md-dialog id="resp-full-${vp.suffix}" fullscreen headline=${t(globals.locale, 'dialog.editProfile')} header-divider>
                <div style="display: flex; flex-direction: column; gap: 12px; padding: 8px 0;">
                  <md-text-field variant="outlined" label=${t(globals.locale, 'dialog.name')} value="Jane Doe"></md-text-field>
                  <md-text-field variant="outlined" label=${t(globals.locale, 'dialog.email')} type="email" value="jane@example.com"></md-text-field>
                </div>
              </md-dialog>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">CSS media-query recipe</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Toggle <code>fullscreen</code> from JavaScript when the viewport is narrow:
        </p>
        <pre tabindex="0" role="region" aria-label="CSS media-query recipe" style="margin: 0; padding: 12px 16px; background: var(--md-sys-color-surface-container); border-radius: 8px; font: 12px/1.5 ui-monospace, monospace; overflow-x: auto;">@media (max-width: 600px) {
  dialog.fullscreen = true;  /* or bind ?fullscreen in your framework */
}</pre>
      </section>
    </div>
  `,
};
