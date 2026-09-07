import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { crumbsFor } from "@awc-ui/showcase-kit/design";
import { StudioService, BASE } from "./lib/studio.service";
@Component({
  selector: "pictor-screen",
  standalone: true,
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<div class="shell__trail">
      @if (crumbs.length) {
        <md-breadcrumbs
          [label]="studio.t('design.nav.breadcrumb')"
          [maxItems]="4"
          [itemsBeforeCollapse]="1"
          [itemsAfterCollapse]="2"
          (mdSelect)="navigate($event)"
        >
          @for (crumb of crumbs; track $index) {
            <md-breadcrumb-item
              [href]="crumb.href ? base + crumb.href : undefined"
              >{{
                crumb.labelKey ? studio.t(crumb.labelKey) : crumb.label
              }}</md-breadcrumb-item
            >
          }
        </md-breadcrumbs>
      }
    </div>
    <header class="screen-head">
      <div class="screen-head__text">
        <h1 class="screen-head__title">{{ title }}</h1>
        <p class="screen-head__subtitle">{{ subtitle }}</p>
      </div>
      <div class="screen-head__aside"><ng-content select="[aside]" /></div>
    </header>
    <div class="screen-stage">
      <div class="screen-body"><ng-content /></div>
    </div>`,
})
export class ScreenComponent {
  @Input() title = "";
  @Input() subtitle = "";
  studio = inject(StudioService);
  base = BASE;
  get crumbs() {
    return crumbsFor(this.studio.router.url.split("?")[0], this.title);
  }
  navigate(event: Event) {
    const { href, originalEvent } = (event as CustomEvent).detail ?? {};
    if (
      !href ||
      originalEvent?.metaKey ||
      originalEvent?.ctrlKey ||
      originalEvent?.shiftKey ||
      originalEvent?.altKey
    )
      return;
    event.preventDefault();
    this.studio.go(href.replace(BASE, "") || "/");
  }
}
@Component({
  selector: "pictor-tabs",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (panel) {
      <md-tabs
        class="studio-panel-tabs"
        [attr.aria-label]="studio.t(label)"
        variant="secondary"
        tab-width="equal"
        [activeTabIndex]="activeIndex"
        (mdTabChange)="tabChange($event)"
      >
        @for (option of options; track option.value) {
          <md-tab
            [label]="studio.t(option.label)"
            [active]="value === option.value"
            [density]="0"
          />
        }
      </md-tabs>
    } @else {
      <md-segmented-button-set
        class="studio-segments"
        [attr.aria-label]="studio.t(label)"
        [density]="-2"
        (mdChange)="segmentChange($event)"
      >
        @for (option of options; track option.value) {
          <md-segmented-button
            [value]="option.value"
            [label]="studio.t(option.label)"
            [icon]="option.icon"
            [selected]="value === option.value"
          />
        }
      </md-segmented-button-set>
    }`,
})
export class TabsComponent {
  studio = inject(StudioService);
  @Input() label = "";
  @Input() value = "";
  @Input() panel = false;
  @Input() options: readonly { value: string; label: string; icon?: string }[] =
    [];
  @Output() changed = new EventEmitter<string>();
  get activeIndex() {
    return Math.max(
      0,
      this.options.findIndex((option) => option.value === this.value),
    );
  }
  tabChange(e: Event) {
    const option = this.options[(e as CustomEvent).detail.index];
    if (option) this.changed.emit(option.value);
  }
  segmentChange(e: Event) {
    const value = (e as CustomEvent).detail?.[0];
    if (value) this.changed.emit(value);
  }
}
@Component({
  selector: "pictor-text",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-text-field
    [value]="value"
    [label]="studio.t(label)"
    [placeholder]="studio.t(placeholder)"
    variant="outlined"
    [density]="-2"
    [multiline]="multiline ? 'auto-grow' : undefined"
    [rows]="multiline ? 3 : undefined"
    (mdInput)="read($event, true)"
    (mdChange)="read($event, false)"
  />`,
})
export class TextComponent {
  studio = inject(StudioService);
  @Input() value = "";
  @Input() label = "";
  @Input() placeholder = "";
  @Input() live = false;
  @Input() multiline = false;
  @Output() changed = new EventEmitter<string>();
  read(event: Event, live: boolean) {
    if (live === this.live)
      this.changed.emit(String((event as CustomEvent).detail ?? ""));
  }
}
@Component({
  selector: "pictor-select",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-select
    [searchPlaceholder]="studio.t('Search…')"
    [filterLabel]="studio.t('Filter options')"
    [noResultsText]="studio.t('No results')"
    [noOptionsText]="studio.t('No options')"
    [clearLabel]="studio.t('Clear selection')"
    [searchingLabel]="studio.t('Searching')"
    [loadingText]="studio.t('Loading…')"
    [value]="value"
    [label]="studio.t(label)"
    variant="outlined"
    [density]="-2"
    (mdChange)="changed.emit($any($event).detail)"
  >
    @for (option of options; track option.value) {
      <md-select-option
        [value]="option.value"
        [label]="studio.t(option.label)"
      />
    }
  </md-select>`,
})
export class SelectComponent {
  studio = inject(StudioService);
  @Input() value = "";
  @Input() label = "";
  @Input() options: readonly { value: string; label: string }[] = [];
  @Output() changed = new EventEmitter<string>();
}
@Component({
  selector: "pictor-range",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<div class="studio-range">
    <div>
      <span>{{ studio.t(label) }}</span
      ><strong
        >{{ draft ?? value }}{{ min === 0 && max === 100 ? "%" : "" }}</strong
      >
    </div>
    <md-slider
      [min]="min"
      [max]="max"
      [step]="step"
      [value]="draft ?? value"
      [attr.aria-label]="studio.t(label)"
      value-indicator
      (mdInput)="draft = $any($event).detail.value"
      (mdChange)="commit($event)"
    />
  </div>`,
})
export class RangeComponent {
  studio = inject(StudioService);
  @Input() value = 100;
  @Input() label = "";
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 5;
  @Output() changed = new EventEmitter<number>();
  draft: number | null = null;
  commit(event: Event) {
    this.changed.emit(Number((event as CustomEvent).detail.value));
    this.draft = null;
  }
}
@Component({
  selector: "pictor-dialog",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-dialog
    #dialog
    [class]="dialogClass"
    [open]="true"
    [locale]="studio.t.locale"
    [headline]="title"
    [fullscreen]="fullscreen"
    [closeLabel]="studio.t('Close dialog')"
    (mdClose)="ownClose($event)"
    (mdCancel)="ownClose($event)"
    ><div class="studio-dialog__content"><ng-content /></div>
    <div slot="actions" class="studio-dialog__actions">
      <ng-content select="[actions]" /></div
  ></md-dialog>`,
})
export class DialogComponent implements AfterViewInit, OnDestroy {
  studio = inject(StudioService);
  @Input() dialogClass = "studio-dialog";
  @Input() title = "";
  @Input() fullscreen = false;
  @Output() closed = new EventEmitter<void>();
  @ViewChild("dialog") dialog?: ElementRef<HTMLElement>;
  private previous: HTMLElement | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    this.previous = el instanceof HTMLElement ? el : null;
  }
  ownClose(e: Event) {
    if (e.target === this.dialog?.nativeElement) this.closed.emit();
  }
  ngAfterViewInit() {
    this.timer = setTimeout(() => {
      const el = this.dialog?.nativeElement;
      const input = el?.querySelector<HTMLElement>("input,[autofocus]");
      if (input) input.focus();
      else
        (
          el?.shadowRoot?.querySelector(
            '[role="dialog"],[role="alertdialog"]',
          ) as HTMLElement | null
        )?.focus();
    }, 60);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
    const target = this.previous;
    requestAnimationFrame(() => {
      if (target?.isConnected && !document.querySelector("md-dialog[open]"))
        target.focus({ preventScroll: true });
    });
  }
}
export const CONTROLS = [
  ScreenComponent,
  TabsComponent,
  TextComponent,
  SelectComponent,
  RangeComponent,
  DialogComponent,
];
