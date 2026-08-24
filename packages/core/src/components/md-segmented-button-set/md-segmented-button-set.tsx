import { Component, Host, h, Prop, Element, Event, EventEmitter, Listen, Watch } from '@stencil/core';
import { SegmentElement } from '../../utils/types';

@Component({
  tag: 'md-segmented-button-set',
  styleUrl: 'md-segmented-button-set.css',
  shadow: true,
})
export class MdSegmentedButtonSet {
  @Element() el!: HTMLElement;

  /** Single-select or multi-select mode */
  @Prop() multiselect: boolean = false;

  /** Density: 0 = 40px, -1 = 36px, -2 = 32px, -3 = 28px, -4 = 24px */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the set of selected segment values changes */
  @Event() mdChange: EventEmitter<string[]>;

  @Watch('multiselect')
  @Watch('density')
  onPropsChange() {
    this.syncSegments();
  }

  componentDidLoad() {
    this.syncSegments();
  }

  @Listen('mdSegmentClick')
  handleSegmentClick(event: CustomEvent<{ value: string; selected: boolean }>) {
    event.stopPropagation();
    const segments = this.getSegments();
    // Match by element identity, not by `.value`. The child segment
    // emits `mdSegmentClick` from its own host, and the event re-targets
    // to that <md-segmented-button> as it crosses the shadow boundary
    // into this set. Matching by value would break whenever segments
    // share the default value of '' (which is the common case when
    // consumers omit the `value` prop — every segment would toggle
    // together because every `'' === ''` is true).
    const clicked = event.target as SegmentElement | null;
    if (!clicked) return;

    const { selected } = event.detail;

    if (this.multiselect) {
      clicked.selected = selected;
    } else {
      for (const seg of segments) {
        seg.selected = seg === clicked;
      }
    }

    this.mdChange.emit(
      segments.filter(s => s.selected).map(s => s.value),
    );
  }

  private getSegments(): SegmentElement[] {
    return Array.from(this.el.querySelectorAll('md-segmented-button')) as unknown as SegmentElement[];
  }

  /**
   * Re-assign positions whenever the slotted segments change.
   *
   * `componentDidLoad` alone is not enough, and the gap is visible rather than
   * theoretical. A segment defaults to `segmentIndex: 0` of `segmentTotal: 1`,
   * which makes it BOTH first and last — so an unsynced segment renders fully
   * rounded on every edge. Replace a set's children after it has loaded and
   * every segment in it becomes a lone pill: the joined bar visibly falls apart,
   * and nothing about it looks like a stale index.
   *
   * Any consumer that renders segments dynamically hits this — a set whose
   * options come from state, a framework re-render, or `replaceChildren()`. The
   * showcase dock rebuilds its controls that way and shows the bug on the first
   * re-render after navigation.
   */
  private handleSlotChange = () => {
    this.syncSegments();
  };

  private syncSegments() {
    const segments = this.getSegments();
    const total = segments.length;

    for (let i = 0; i < total; i++) {
      const seg = segments[i];
      seg.segmentIndex = i;
      seg.segmentTotal = total;
      seg.segmentDensity = this.density;
      seg.segmentMultiselect = this.multiselect;
    }
  }

  render() {
    return (
      <Host
        class={{
          'md-segmented-button-set': true,
          [`md-segmented-button-set--density-${Math.abs(this.density)}`]: this.density !== 0,
        }}
        role={this.multiselect ? 'group' : 'radiogroup'}
      >
        <slot onSlotchange={this.handleSlotChange}></slot>
      </Host>
    );
  }
}
