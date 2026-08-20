import { Component, Host, h, Prop, Element, Event, EventEmitter, Watch } from '@stencil/core';
import { ToggleableElement } from '../../utils/types';

/**
 * Pixel delta per side for the active button in standard mode.
 * Neighbors absorb the same total so the group width stays constant.
 */
const EXPAND_PX: Record<string, number> = {
  xs: 3, sm: 4, md: 5, lg: 6, xl: 8,
};

/**
 * Detail payload emitted by `md-button-group`'s `mdSelectionChange` event
 * when the set of selected child buttons changes due to a user activation.
 *
 * The detail is a structured object so consumers can react to the
 * specific delta (which value was just added or removed) instead of
 * diffing the previous selection themselves.
 */
export interface MdButtonGroupChangeDetail {
  /** Snapshot of every selected `value` after this change. */
  values: string[];
  /** Values newly added by this change (usually 0 or 1 entries). */
  added: string[];
  /** Values newly removed by this change (usually 0 or 1 entries). */
  removed: string[];
  /** The original click event that triggered the change. */
  originalEvent: MouseEvent;
}

@Component({
  tag: 'md-button-group',
  styleUrl: 'md-button-group.css',
  shadow: true,
})
export class MdButtonGroup {
  @Element() el!: HTMLElement;

  /** Standard groups add padding between buttons; connected groups fuse them together */
  @Prop() variant: 'standard' | 'connected' = 'standard';

  /** Button size — controls gap (standard) and inner corner radii (connected) */
  @Prop() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';

  /** Default shape applied to all child buttons */
  @Prop() shape: 'round' | 'square' = 'round';

  /** Selection mode */
  @Prop() selectionMode: 'single-select' | 'multi-select' = 'single-select';

  /** When true, at least one button must remain selected */
  @Prop() required: boolean = false;

  /**
   * When `true` the group stretches to 100% of its container's inline-size
   * and its children share that space equally (`flex: 1 1 0`). Combine with
   * the `--md-button-group-width` / `--md-button-group-max-width` CSS custom
   * properties for fine-grained control over the final size.
   */
  @Prop({ reflect: true, attribute: 'full-width' }) fullWidth: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires every time a user activation toggles the selection state of
   * a child button. The detail object describes both the new selection
   * snapshot (`values`) and the diff from the previous selection
   * (`added`, `removed`), plus the underlying `originalEvent`.
   *
   * Distinct from each child button's own `mdChange` (which fires per
   * individual button toggle); the group's `mdSelectionChange` fires
   * once per user activation and reports the *group-level* state.
   *
   * Bubbles and is composed so listeners outside the shadow tree
   * receive it.
   *
   * @example
   * ```ts
   * group.addEventListener('mdSelectionChange', (e: CustomEvent<MdButtonGroupChangeDetail>) => {
   *   console.log('now selected:', e.detail.values);
   *   console.log('just added:', e.detail.added);
   *   console.log('just removed:', e.detail.removed);
   * });
   * ```
   */
  @Event({ bubbles: true, composed: true })
  mdSelectionChange!: EventEmitter<MdButtonGroupChangeDetail>;

  private motionAnimations: Animation[] = [];

  @Watch('variant')
  @Watch('size')
  @Watch('shape')
  @Watch('selectionMode')
  @Watch('required')
  onPropsChange() {
    this.syncChildren();
    this.updateRovingTabindex();
  }

  componentDidLoad() {
    this.observeSlot();
    this.syncChildren();
    this.updateRovingTabindex();
    this.el.addEventListener('click', this.onGroupClick);
    this.el.addEventListener('keydown', this.onArrowNav);
    this.el.addEventListener('focusin', this.onFocusIn);
    if (this.variant === 'standard') {
      this.el.addEventListener('pointerdown', this.onGroupPointerDown);
      this.el.addEventListener('keydown', this.onGroupKeyDown, true);
    }
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.el.removeEventListener('click', this.onGroupClick);
    this.el.removeEventListener('keydown', this.onArrowNav);
    this.el.removeEventListener('focusin', this.onFocusIn);
    this.el.removeEventListener('pointerdown', this.onGroupPointerDown);
    this.el.removeEventListener('keydown', this.onGroupKeyDown, true);
  }

  private observer?: MutationObserver;

  private observeSlot() {
    if (typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver(() => {
      this.syncChildren();
      this.updateRovingTabindex();
    });
    this.observer.observe(this.el, { childList: true });
  }

  // ── Standard variant: press motion via Web Animations API ──

  private shouldMotion(target: HTMLElement): boolean {
    if (!(target as ToggleableElement).selected) return true;
    if (this.required) return false;
    return true;
  }

  private onGroupPointerDown = (e: PointerEvent) => {
    if (this.variant !== 'standard') return;
    const target = (e.target as HTMLElement).closest('md-button, md-icon-button') as HTMLElement | null;
    if (target && this.shouldMotion(target)) this.runMotion(target);
  };

  private onGroupKeyDown = (e: KeyboardEvent) => {
    if (this.variant !== 'standard') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = (e.target as HTMLElement).closest('md-button, md-icon-button') as HTMLElement | null;
    if (target && this.shouldMotion(target)) this.runMotion(target);
  };

  private runMotion(target: HTMLElement) {
    const children = this.getChildren();
    const index = children.indexOf(target);
    if (index === -1) return;

    for (const anim of this.motionAnimations) {
      anim.cancel();
    }
    this.motionAnimations = [];

    const active = EXPAND_PX[this.size];

    const hasLeft = index > 0;
    const hasRight = index < children.length - 1;
    const neighborCount = (hasLeft ? 1 : 0) + (hasRight ? 1 : 0);
    if (neighborCount === 0) return;

    const neighborDelta = active / neighborCount;

    // Same easing as md-icon-button shape morph press/release,
    // using easing-standard for both to keep it crisp (no overshoot).
    const ease = 'cubic-bezier(0.2, 0, 0, 1)';
    const totalMs = 400;
    const peakOffset = 150 / totalMs;

    for (let i = 0; i < children.length; i++) {
      const isActive = i === index;
      const isNeighbor = i === index - 1 || i === index + 1;
      if (!isActive && !isNeighbor) continue;

      const child = children[i];
      const delta = isActive ? active : -neighborDelta;

      let anim: Animation;

      if (child.tagName === 'MD-BUTTON') {
        const cs = getComputedStyle(child);
        const pl = parseFloat(cs.paddingLeft);
        const pr = parseFloat(cs.paddingRight);
        const peakL = `${Math.max(0, pl + delta)}px`;
        const peakR = `${Math.max(0, pr + delta)}px`;
        const baseL = `${pl}px`;
        const baseR = `${pr}px`;

        anim = child.animate(
          [
            { offset: 0,          paddingLeft: baseL, paddingRight: baseR, easing: ease },
            { offset: peakOffset,  paddingLeft: peakL, paddingRight: peakR, easing: ease },
            { offset: 1,          paddingLeft: baseL, paddingRight: baseR },
          ],
          { duration: totalMs },
        );
      } else {
        const w = parseFloat(getComputedStyle(child).width);
        const peakW = `${Math.max(0, w + delta * 2)}px`;
        const baseW = `${w}px`;

        anim = child.animate(
          [
            { offset: 0,          width: baseW, easing: ease },
            { offset: peakOffset,  width: peakW, easing: ease },
            { offset: 1,          width: baseW },
          ],
          { duration: totalMs },
        );
      }

      this.motionAnimations.push(anim);
    }
  }

  // ── Selection ──────────────────────────────────────────

  /** Snapshot of the previous selection used to compute change diffs. */
  private previousValues: string[] = [];

  private collectSelectedValues(children: HTMLElement[]): string[] {
    return children
      .filter(c => (c as ToggleableElement).selected)
      .map(c => (c as ToggleableElement).value || '');
  }

  componentWillLoad() {
    // Seed the previous values so the first emitted diff is meaningful.
    this.previousValues = this.collectSelectedValues(this.getChildren());
  }

  private onGroupClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest?.('md-button, md-icon-button') as HTMLElement | null;
    if (!target) return;

    const children = this.getChildren();
    if (!children.includes(target)) return;

    // The child already toggled its own selected state via its onClick.
    if (this.selectionMode === 'single-select') {
      for (const child of children) {
        if (child !== target) (child as ToggleableElement).selected = false;
      }
    }

    // Enforce required: if nothing is selected, re-select the clicked button.
    if (this.required) {
      const anySelected = children.some(c => (c as ToggleableElement).selected);
      if (!anySelected) {
        (target as ToggleableElement).selected = true;
      }
    }

    const nextValues = this.collectSelectedValues(children);
    const previousSet = new Set(this.previousValues);
    const nextSet = new Set(nextValues);
    const added = nextValues.filter(v => !previousSet.has(v));
    const removed = this.previousValues.filter(v => !nextSet.has(v));

    this.previousValues = nextValues;

    // Selection change in single-select mode promotes the clicked button to
    // the active roving-tabindex child so Tab returns here next time.
    this.activeChild = target;
    this.updateRovingTabindex();

    this.mdSelectionChange.emit({
      values: nextValues,
      added,
      removed,
      originalEvent: e,
    });
  };

  // ── Roving keyboard navigation (radiogroup / toolbar pattern) ──

  /**
   * ArrowLeft/Right move focus between buttons in the group; Home/End jump
   * to the first/last. In RTL, Left/Right semantics swap so focus follows
   * the visual flow. Disabled buttons are skipped.
   */
  private onArrowNav = (e: KeyboardEvent) => {
    const key = e.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;

    const children = this.getChildren().filter(c => !(c as any).disabled);
    if (children.length === 0) return;

    const active = (e.target as HTMLElement).closest('md-button, md-icon-button') as HTMLElement | null;
    const currentIndex = active ? children.indexOf(active) : -1;
    const isRtl = this.resolveDirection() === 'rtl';

    let nextIndex = currentIndex;
    if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = children.length - 1;
    } else {
      const forward = (key === 'ArrowRight') !== isRtl;
      const delta = forward ? 1 : -1;
      nextIndex = currentIndex < 0
        ? (forward ? 0 : children.length - 1)
        : (currentIndex + delta + children.length) % children.length;
    }

    const next = children[nextIndex];
    if (!next || next === active) return;

    e.preventDefault();
    this.activeChild = next;
    this.updateRovingTabindex();
    (next as HTMLElement).focus();
  };

  // ── Roving tabindex (one-stop Tab into the group) ──────

  /**
   * Tracks which child currently owns the group's single tab stop.
   * Updated by focusin (user interaction), arrow-key navigation,
   * and click-driven selection changes.
   */
  private activeChild: HTMLElement | null = null;

  private onFocusIn = (e: FocusEvent) => {
    const target = (e.target as HTMLElement)?.closest?.('md-button, md-icon-button') as HTMLElement | null;
    if (!target) return;
    if (target === this.activeChild) return;
    const children = this.getChildren();
    if (!children.includes(target)) return;
    this.activeChild = target;
    this.updateRovingTabindex();
  };

  /**
   * Picks one child as the group's tab stop and sets `groupTabindex` on
   * each: `0` for the active child, `-1` for the rest. Active child is:
   *   1. the most recently focused/clicked child (if still in the group), or
   *   2. the selected child in single-select mode, or
   *   3. the first non-disabled child.
   * Falls back to the first child if everything is disabled.
   */
  private updateRovingTabindex() {
    const children = this.getChildren();
    if (children.length === 0) return;

    let active: HTMLElement | null = null;

    if (this.activeChild && children.includes(this.activeChild) && !(this.activeChild as any).disabled) {
      active = this.activeChild;
    }

    if (!active && this.selectionMode === 'single-select') {
      active = children.find(c => (c as ToggleableElement).selected && !(c as any).disabled) || null;
    }

    if (!active) {
      active = children.find(c => !(c as any).disabled) || children[0];
    }

    this.activeChild = active;

    for (const child of children) {
      (child as any).groupTabindex = child === active ? 0 : -1;
    }
  }

  private resolveDirection(): 'ltr' | 'rtl' {
    let node: HTMLElement | null = this.el;
    while (node) {
      const dir = node.getAttribute?.('dir');
      if (dir === 'rtl' || dir === 'ltr') return dir;
      node = node.parentElement;
    }
    return 'ltr';
  }

  // ── Child syncing ──────────────────────────────────────

  private getChildren(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll('md-button, md-icon-button'));
  }

  private syncChildren() {
    const children = this.getChildren();
    const total = children.length;
    if (total === 0) return;

    for (let i = 0; i < total; i++) {
      const child = children[i] as ToggleableElement;

      child.toggle = true;
      child.shape = this.shape;
      child.size = this.size;

      if (this.variant === 'connected') {
        child.connectedLeft = i > 0;
        child.connectedRight = i < total - 1;
      } else {
        child.connectedLeft = false;
        child.connectedRight = false;
      }
    }
  }

  render() {
    const useRadioGroup = this.selectionMode === 'single-select';

    return (
      <Host
        class={{
          'md-button-group': true,
          [`md-button-group--${this.variant}`]: true,
          [`md-button-group--${this.size}`]: true,
          [`md-button-group--${this.shape}`]: true,
          'md-button-group--full-width': this.fullWidth,
        }}
        role={useRadioGroup ? 'radiogroup' : 'group'}
        // `aria-orientation` is only permitted on roles that support it.
        // `radiogroup` does; the generic `group` role does not (axe
        // `aria-allowed-attr`), so omit it in multi-select mode.
        aria-orientation={useRadioGroup ? 'horizontal' : undefined}
      >
        <slot></slot>
      </Host>
    );
  }
}
