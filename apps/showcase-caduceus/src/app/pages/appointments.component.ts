import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Upcoming {
  provider: string;
  detail: string;
}

const VISIT_TYPES: Record<string, string> = {
  physical: 'Annual physical (60 min)',
  followup: 'Follow-up visit (30 min)',
  lab: 'Lab review (15 min)',
  telehealth: 'Telehealth check-in (20 min)',
};

const PROVIDERS: Record<string, string> = {
  okafor: 'Dr. Imani Okafor — Internal medicine',
  lindqvist: 'Dr. Petra Lindqvist — Cardiology',
  ortega: 'Dr. Samuel Ortega — Family medicine',
};

@Component({
  selector: 'app-appointments',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="page">
      <header>
        <h1 class="page-title">Appointments</h1>
        <p class="page-subtitle">Brookmere Clinic · 418 Harrow Lane · Front desk (406) 555-0117</p>
      </header>

      <md-card variant="outlined">
        <h2 class="section-title list-head">Upcoming</h2>
        <md-list>
          @for (appt of upcoming(); track appt.detail; let last = $last) {
            <md-list-item lines="2" [attr.headline]="appt.provider" [attr.supporting-text]="appt.detail">
              <md-chip slot="trailing" color="success" label="Confirmed"></md-chip>
            </md-list-item>
            @if (!last) {
              <md-divider></md-divider>
            }
          }
        </md-list>
      </md-card>

      <md-card variant="elevated" class="intake-card">
        <h2 class="section-title">Book a new visit</h2>
        <p class="page-subtitle intake-sub">
          Three quick steps — we confirm by text message within the hour.
        </p>

        <md-stepper
          #intake
          orientation="horizontal"
          mode="linear"
          finish-label="Book appointment"
          next-label="Continue"
          back-label="Back"
          [attr.next-disabled]="nextDisabled() ? 'true' : 'false'"
          (mdStepChange)="activeStep.set($event.detail.index)"
          (mdComplete)="book()"
        >
          <md-step label="Visit details" description="What brings you in">
            <div class="step-grid">
              <md-select
                variant="outlined"
                label="Visit type"
                required
                [attr.value]="visitType()"
                (mdChange)="visitType.set($event.detail)"
              >
                <md-select-option value="physical" label="Annual physical (60 min)"></md-select-option>
                <md-select-option value="followup" label="Follow-up visit (30 min)"></md-select-option>
                <md-select-option value="lab" label="Lab review (15 min)"></md-select-option>
                <md-select-option value="telehealth" label="Telehealth check-in (20 min)"></md-select-option>
              </md-select>

              <md-select
                variant="outlined"
                label="Provider"
                required
                [attr.value]="provider()"
                (mdChange)="provider.set($event.detail)"
              >
                <md-select-option value="okafor" label="Dr. Imani Okafor — Internal medicine"></md-select-option>
                <md-select-option value="lindqvist" label="Dr. Petra Lindqvist — Cardiology"></md-select-option>
                <md-select-option value="ortega" label="Dr. Samuel Ortega — Family medicine"></md-select-option>
              </md-select>

              <md-text-field
                class="span-2"
                variant="outlined"
                label="Reason for visit (optional)"
                multiline="auto-grow"
                rows="2"
                max-length="240"
                supporting-text="Shared with your care team before the visit"
                [attr.value]="reason()"
                (mdChange)="reason.set($event.detail)"
              ></md-text-field>
            </div>
          </md-step>

          <md-step label="Schedule" description="Pick a date and time">
            <div class="step-grid">
              <md-date-picker
                label="Date"
                min="2026-08-24"
                max="2026-11-27"
                commit-on-select
                clearable
                supporting-text="Weekdays only, up to 3 months out"
                [attr.value]="date()"
                (mdChange)="date.set($event.detail.value)"
              ></md-date-picker>

              <md-time-picker
                label="Time"
                variant="input"
                format="12h"
                min="08:00"
                max="16:45"
                minute-step="15"
                [attr.value]="time()"
                (mdChange)="time.set($event.detail.value)"
              ></md-time-picker>

              <p class="span-2 schedule-hint">
                Clinic hours are 8:00 AM – 5:00 PM. Telehealth visits open a video link 10 minutes
                before the start time.
              </p>
            </div>
          </md-step>

          <md-step label="Review" description="Confirm the details">
            <dl class="review">
              <div><dt>Visit</dt><dd>{{ visitTypeLabel() }}</dd></div>
              <div><dt>Provider</dt><dd>{{ providerLabel() }}</dd></div>
              <div><dt>When</dt><dd>{{ whenLabel() }}</dd></div>
              <div><dt>Location</dt><dd>Brookmere Clinic, 418 Harrow Lane, Suite 2</dd></div>
              @if (reason()) {
                <div><dt>Reason</dt><dd>{{ reason() }}</dd></div>
              }
            </dl>
            <p class="schedule-hint">
              Bring your insurance card and arrive 15 minutes early for check-in. Cancel or
              reschedule up to 24 hours before the visit at no charge.
            </p>
          </md-step>
        </md-stepper>
      </md-card>

      <md-snackbar #confirmToast [attr.message]="confirmMessage()"></md-snackbar>
    </main>
  `,
  styles: [
    `
      .list-head {
        padding: 16px 16px 4px;
      }
      .intake-card {
        padding: 24px;
      }
      .intake-sub {
        margin-block-end: 16px;
      }
      .step-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        padding-block: 16px;
      }
      .span-2 {
        grid-column: span 2;
      }
      @media (max-width: 640px) {
        .step-grid {
          grid-template-columns: 1fr;
        }
        .span-2 {
          grid-column: auto;
        }
      }
      .schedule-hint {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant);
        font: var(--md-sys-typescale-body-medium-font);
      }
      .review {
        margin: 16px 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .review div {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
      }
      .review dt {
        color: var(--md-sys-color-on-surface-variant);
        font: var(--md-sys-typescale-label-large-font);
      }
      .review dd {
        margin: 0;
        font: var(--md-sys-typescale-body-medium-font);
      }
    `,
  ],
})
export class AppointmentsComponent {
  private platformId = inject(PLATFORM_ID);

  @ViewChild('intake') intakeRef?: ElementRef<HTMLElement>;
  @ViewChild('confirmToast') toastRef?: ElementRef<HTMLElement>;

  visitType = signal('');
  provider = signal('');
  reason = signal('');
  date = signal('');
  time = signal('');
  activeStep = signal(0);
  confirmMessage = signal('Appointment booked');

  upcoming = signal<Upcoming[]>([
    {
      provider: 'Dr. Imani Okafor — Internal medicine',
      detail: 'Wed, Sep 2 · 9:30 AM · Brookmere Clinic, Suite 2',
    },
    {
      provider: 'Dr. Petra Lindqvist — Cardiology',
      detail: 'Fri, Sep 18 · 1:15 PM · Telehealth video visit',
    },
  ]);

  visitTypeLabel = computed(() => VISIT_TYPES[this.visitType()] ?? '—');
  providerLabel = computed(() => PROVIDERS[this.provider()] ?? '—');

  whenLabel = computed(() => {
    if (!this.date() || !this.time()) return '—';
    return `${this.formatDate(this.date())} at ${this.formatTime(this.time())}`;
  });

  nextDisabled = computed(() => {
    switch (this.activeStep()) {
      case 0:
        return !(this.visitType() && this.provider());
      case 1:
        return !(this.date() && this.time());
      default:
        return false;
    }
  });

  book() {
    const provider = PROVIDERS[this.provider()] ?? 'your provider';
    const when = this.whenLabel();
    this.confirmMessage.set(`Booked with ${provider.split(' — ')[0]} on ${when}`);

    this.upcoming.update((list) => [
      ...list,
      {
        provider,
        detail: `${when} · Brookmere Clinic, Suite 2`,
      },
    ]);

    if (isPlatformBrowser(this.platformId)) {
      (this.toastRef?.nativeElement as any)?.show?.();
      (this.intakeRef?.nativeElement as any)?.reset?.();
    }
    this.visitType.set('');
    this.provider.set('');
    this.reason.set('');
    this.date.set('');
    this.time.set('');
    this.activeStep.set(0);
  }

  private formatDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
}
