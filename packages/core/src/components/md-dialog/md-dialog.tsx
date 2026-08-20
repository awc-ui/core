import { Component, Host, h, Prop, Event, EventEmitter, Method, Watch, State, Element, Listen } from '@stencil/core';
import { resolveDialogLabel } from './dialog-utils';

@Component({
  tag: 'md-dialog',
  styleUrl: 'md-dialog.css',
  shadow: true,
})
export class MdDialog {
  @Element() el!: HTMLElement;

  /** Whether the dialog is open */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Headline text (or use the headline slot) */
  @Prop() headline: string = '';

  /** Icon name (Material Symbols shorthand, or use the icon slot) */
  @Prop() icon: string = '';

  /** Full-screen variant */
  @Prop({ reflect: true }) fullscreen: boolean = false;

  /** Whether clicking the scrim closes the dialog */
  @Prop({ attribute: 'scrim-dismissible' }) scrimDismissible: boolean = true;

  /** BCP-47 locale for built-in button labels (Close, Cancel, OK). */
  @Prop() locale: string = 'en-US';

  /**
   * Accessible label for the full-screen close button.
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'close-label' }) closeLabel: string = '';

  /**
   * Label for the default cancel action button (slot fallback).
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'cancel-label' }) cancelLabel: string = '';

  /**
   * Label for the default confirm action button (slot fallback).
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'ok-label' }) okLabel: string = '';

  /** Show divider between content and actions */
  @Prop({ reflect: true }) divider: boolean = false;

  /** Show divider between header and content (full-screen) */
  @Prop({ attribute: 'header-divider', reflect: true }) headerDivider: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when the dialog opens */
  @Event() mdOpen: EventEmitter<void>;

  /** Emits when the dialog closes */
  @Event() mdClose: EventEmitter<void>;

  /** Emits when dismissed via scrim or Escape */
  @Event() mdCancel: EventEmitter<void>;

  @State() private animating: boolean = false;
  @State() private hasSlottedIcon = false;
  @State() private hasSlottedHeadline = false;
  @State() private hasSlottedActions = false;

  private headlineId = `md-dialog-headline-${Math.random().toString(36).slice(2)}`;
  private contentId = `md-dialog-content-${Math.random().toString(36).slice(2)}`;
  private containerEl!: HTMLElement;
  private previousFocus: HTMLElement | null = null;

  @Watch('open')
  openChanged(newVal: boolean) {
    this.animating = true;
    setTimeout(() => { this.animating = false; }, 300);

    if (newVal) {
      this.previousFocus = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      this.mdOpen.emit();
      requestAnimationFrame(() => this.focusFirst());
    } else {
      document.body.style.overflow = '';
      this.mdClose.emit();
      // `preventScroll` because a bare focus() scrolls its target into view: an
      // overlay opened programmatically (or whose opener has since scrolled out
      // of sight) would yank the page on close.
      this.previousFocus?.focus?.({ preventScroll: true });
      this.previousFocus = null;
    }
  }

  connectedCallback() {
    if (this.open) {
      document.body.style.overflow = 'hidden';
    }
  }

  componentWillLoad() {
    // Seed slot-presence flags from the LIGHT-DOM children that are
    // already in place on first render. The headline / icon slots
    // are rendered *conditionally* — the surrounding wrapper only
    // mounts when "we have a headline". If the user passes ONLY
    // slotted content (no `headline` / `icon` prop), the first
    // render has no slot in shadow DOM yet, so `slotchange` (wired
    // in componentDidLoad) can never fire and we'd be stuck rendering
    // nothing — exactly the "custom headline slot doesn't show" bug.
    //
    // We walk direct children explicitly (rather than running a
    // `:scope > [slot="…"]` query) because Stencil's mock-doc
    // doesn't yet implement the `:scope` pseudo-class. Children-
    // walking is also fractionally cheaper for the small N of
    // direct dialog children.
    this.hasSlottedHeadline = this.hasDirectSlottedChild('headline');
    this.hasSlottedIcon = this.hasDirectSlottedChild('icon');
    this.hasSlottedActions = this.hasDirectSlottedChild('actions');
  }

  private hasDirectSlottedChild(slotName: string): boolean {
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].getAttribute('slot') === slotName) return true;
    }
    return false;
  }

  componentDidLoad() {
    // Once the slot wrappers exist (because the seed above made them
    // render), register `slotchange` listeners so dynamic add/remove
    // of slotted children at runtime keeps the host state in sync.
    this.bindSlotListener('icon', (v) => { this.hasSlottedIcon = v; });
    this.bindSlotListener('headline', (v) => {
      this.hasSlottedHeadline = v;
    });
    this.bindSlotListener('actions', (v) => {
      this.hasSlottedActions = v;
    });
  }

  private bindSlotListener(
    name: string,
    setter: (hasContent: boolean) => void,
  ): void {
    const slot = this.el.shadowRoot?.querySelector(
      `slot[name="${name}"]`,
    ) as HTMLSlotElement | null;
    if (!slot) return;
    slot.addEventListener('slotchange', () => {
      setter(slot.assignedElements().length > 0);
    });
  }

  disconnectedCallback() {
    document.body.style.overflow = '';
  }

  /** Open the dialog */
  @Method()
  async show() {
    this.open = true;
  }

  /** Close the dialog */
  @Method()
  async close() {
    this.open = false;
  }

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.mdCancel.emit();
      this.open = false;
      return;
    }

    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private handleScrimClick = () => {
    if (!this.scrimDismissible) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleCloseClick = () => {
    this.mdCancel.emit();
    this.open = false;
  };

  private handleDefaultOkClick = () => {
    this.open = false;
  };

  private resolvedLabel(
    explicit: string,
    key: 'close' | 'cancel' | 'ok',
  ): string {
    return explicit || resolveDialogLabel(this.locale, key);
  }

  private focusFirst() {
    if (!this.containerEl) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl.focus();
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // The naïve `document.activeElement === first` check breaks the
    // moment a slotted custom element (md-text-field, md-radio, …) owns
    // focus: focus retargets to the host at every shadow boundary, so
    // `document.activeElement` reports the host while `focusable[]`
    // contains the inner <input>. `getDeepActiveElement()` walks down
    // every open `shadowRoot.activeElement` link until it bottoms out
    // on the actual focused leaf, which is what `focusable[]` stores.
    const deep = getDeepActiveElement();

    if (e.shiftKey) {
      if (deep === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (deep === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Tabbable selector intentionally excludes hidden inputs / radios
  // managed by a roving tabindex (-1) — those should never count as
  // a stop in the dialog's tab order.
  private static FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), ' +
    'audio[controls], video[controls], summary, ' +
    '[tabindex]:not([tabindex="-1"])';

  private renderActions() {
    if (this.hasSlottedActions) {
      return (
        <div class="md-dialog__actions" part="actions">
          <slot name="actions" />
        </div>
      );
    }

    return (
      <div class="md-dialog__actions" part="actions">
        <md-button
          variant="text"
          onMdClick={this.handleCloseClick}
          part="cancel-button"
        >
          {this.resolvedLabel(this.cancelLabel, 'cancel')}
        </md-button>
        <md-button
          variant="filled"
          onMdClick={this.handleDefaultOkClick}
          part="ok-button"
        >
          {this.resolvedLabel(this.okLabel, 'ok')}
        </md-button>
      </div>
    );
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.containerEl) return [];

    const collected: HTMLElement[] = [];

    // 1. Built-in chrome inside md-dialog's own shadow root (the
    //    fullscreen close button lives here).
    collectTabbablesDeep(
      this.containerEl,
      MdDialog.FOCUSABLE_SELECTOR,
      collected,
    );

    // 2. Slotted light-DOM content. For each assigned element we (a)
    //    consider the host itself if it advertises a real tabindex
    //    (md-button, md-radio, …) AND (b) descend into ITS shadow
    //    root + light-DOM children. The shadow descent is what
    //    surfaces the inner <input> of an <md-text-field>, the
    //    inner <button> of a custom icon-button wrapper, etc.
    const slots = this.containerEl.querySelectorAll('slot');
    slots.forEach((slot) => {
      const assigned = (slot as HTMLSlotElement).assignedElements({
        flatten: true,
      });
      assigned.forEach((el) => {
        if ((el as HTMLElement).matches?.(MdDialog.FOCUSABLE_SELECTOR)) {
          collected.push(el as HTMLElement);
        }
        collectTabbablesDeep(el as Element, MdDialog.FOCUSABLE_SELECTOR, collected);
      });
    });

    // De-dupe: a host that exposes its own focusable inner element
    // (e.g. an md-button host with tabindex=0 AND an internal button
    // in its shadow root) would otherwise contribute two stops for
    // the same visual control. Keep the FIRST occurrence — that's the
    // host the user/screen reader sees.
    const seen = new Set<HTMLElement>();
    const deduped: HTMLElement[] = [];
    for (const el of collected) {
      // For host-with-shadow custom elements, prefer the host: drop
      // any later focusable that is a shadow-descendant of an already-
      // added host.
      if (deduped.some((h) => isShadowDescendant(el, h))) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      deduped.push(el);
    }

    return deduped.filter(isVisible);
  }

  render() {
    const hasIcon = !!this.icon || this.hasSlottedIcon;
    // `headline` prop OR slotted `[slot="headline"]` child counts as
    // "has a headline". Without the slot fork the entire headline
    // wrapper (and the slot inside it) was suppressed when only
    // slotted content was provided, which made the slot effectively
    // unreachable.
    const hasHeadline = !!this.headline || this.hasSlottedHeadline;

    return (
      <Host
        class={{
          'md-dialog': true,
          'md-dialog--open': this.open,
          'md-dialog--fullscreen': this.fullscreen,
          'md-dialog--animating': this.animating,
          'md-dialog--has-icon': hasIcon,
        }}
      >
        {/* Scrim */}
        {!this.fullscreen && (
          <div
            class="md-dialog__scrim"
            part="scrim"
            aria-hidden="true"
            onClick={this.handleScrimClick}
          ></div>
        )}

        {/* Container */}
        <div
          class="md-dialog__container"
          part="container"
          role={this.fullscreen ? 'dialog' : 'alertdialog'}
          aria-modal="true"
          aria-labelledby={hasHeadline ? this.headlineId : undefined}
          aria-describedby={this.contentId}
          tabindex={-1}
          ref={(el) => (this.containerEl = el!)}
        >
          {/* Full-screen header */}
          {this.fullscreen && (
            <div class="md-dialog__header" part="header">
              <button
                class="md-dialog__close-btn"
                part="close-button"
                aria-label={this.resolvedLabel(this.closeLabel, 'close')}
                onClick={this.handleCloseClick}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
              {hasHeadline && (
                <span id={this.headlineId} class="md-dialog__header-headline" part="headline">
                  {this.headline}
                </span>
              )}
              <slot name="header-action"></slot>
            </div>
          )}

          {this.fullscreen && this.headerDivider && (
            <div class="md-dialog__divider" part="divider" aria-hidden="true"></div>
          )}

          {/* Basic header: icon + headline */}
          {!this.fullscreen && (
            <div class="md-dialog__basic-header" part="header">
              {/* Icon */}
              <slot name="icon">
                {this.icon && (
                  <span class="md-dialog__icon material-symbols-outlined" part="icon" aria-hidden="true">
                    {this.icon}
                  </span>
                )}
              </slot>

              {/* Headline */}
              {hasHeadline && (
                <div
                  id={this.headlineId}
                  class="md-dialog__headline"
                  part="headline"
                >
                  <slot name="headline">{this.headline}</slot>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div id={this.contentId} class="md-dialog__content" part="content">
            <slot></slot>
          </div>

          {/* Divider */}
          {this.divider && (
            <div class="md-dialog__divider" part="divider" aria-hidden="true"></div>
          )}

          {/* Actions */}
          {this.renderActions()}
        </div>
      </Host>
    );
  }
}

// ─── Module-private focus-trap helpers ─────────────────────────────
//
// Lifted out of the class so the focus-trap logic stays declarative
// (`getFocusableElements()` reads as a pipeline, not a maze of inline
// recursions) AND so each helper is independently unit-testable in
// the future without instantiating a Stencil component.

/** Walk into every open shadow root reachable from `root`, collecting
 *  every element matching `selector`. Light-DOM `querySelectorAll`
 *  doesn't pierce shadow boundaries on its own — this helper does the
 *  recursion explicitly. Closed shadow roots are inaccessible by spec
 *  and silently skipped (third-party closed-shadow components inside
 *  the dialog will simply not contribute focus stops). */
function collectTabbablesDeep(
  root: Element | ShadowRoot,
  selector: string,
  out: HTMLElement[],
): void {
  const direct = root.querySelectorAll<HTMLElement>(selector);
  direct.forEach((el) => out.push(el));

  // Walk every descendant looking for shadow roots. We can't use
  // `:has(*)` or similar — we must enumerate every element to peek at
  // `.shadowRoot`. The cost is bounded by the dialog's subtree, which
  // is always small.
  const everything = root.querySelectorAll<Element>('*');
  everything.forEach((el) => {
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) collectTabbablesDeep(sr, selector, out);
  });
}

/** Find the actually-focused element, regardless of how many open
 *  shadow boundaries it sits behind. `document.activeElement` reports
 *  the host of the topmost open shadow root, so for an `<input>`
 *  inside `<md-text-field>` it returns `<md-text-field>` rather than
 *  the input. We chase `shadowRoot.activeElement` until it bottoms
 *  out — the leaf is what `collectTabbablesDeep()` stored in the
 *  focusable list, so a `===` comparison against it works. */
function getDeepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active) {
    const sr = (active as Element & { shadowRoot?: ShadowRoot | null })
      .shadowRoot;
    if (!sr || !sr.activeElement) break;
    active = sr.activeElement;
  }
  return active;
}

/** True if `node` lives inside the shadow root of `host` (at any
 *  depth). Used to de-dupe when both a custom-element host and one
 *  of its shadow descendants would land in the focusable list — the
 *  host wins and the descendant is dropped. */
function isShadowDescendant(node: Element, host: Element): boolean {
  // No shadow root means `host` can't have shadow descendants at all.
  if (!(host as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
    return false;
  }
  let cursor: Node | null = node;
  while (cursor) {
    const root = cursor.getRootNode?.();
    if (root && (root as ShadowRoot).host === host) return true;
    // Step out of the current shadow root, if any, then continue
    // walking up the next ancestor chain.
    if (root && (root as ShadowRoot).host) {
      cursor = (root as ShadowRoot).host;
    } else {
      cursor = (cursor as Element).parentNode;
    }
  }
  return false;
}

/** Tab-order visibility check that survives shadow boundaries.
 *  `offsetParent` returns null for shadow descendants in some engines
 *  (and for `position: fixed` elements always), so we fall back to a
 *  bounding-rect probe — an element with non-zero size in the layout
 *  tree is what the user can actually focus. */
function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return true;
  // Off-screen-but-laid-out check (e.g. virtualised inputs that have
  // zero box but are still tabbable in the DOM). Conservative — if
  // both probes fail we treat the element as not focusable.
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}
