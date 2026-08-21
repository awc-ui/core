import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="signin-wrap">
      <form class="signin-form" (submit)="onSubmit($event)">
        <md-card variant="elevated" class="signin-card">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">C</span>
            <h1 class="brand-name">Caduceus Health</h1>
            <p class="brand-tag">Patient portal</p>
          </div>

          @if (phase() === 'credentials') {
            <md-text-field
              variant="outlined"
              label="Email"
              type="email"
              name="email"
              autocomplete="username"
              required
              supporting-text="The address on your patient record"
              reserve-supporting-space
            ></md-text-field>

            <md-text-field
              variant="outlined"
              label="Password"
              type="password"
              name="password"
              autocomplete="current-password"
              password-toggle="internal"
              required
              min-length="8"
              reserve-supporting-space
            ></md-text-field>

            <md-button variant="filled" type="submit" full-width>Continue</md-button>
            <md-button variant="text" type="button" full-width>Trouble signing in?</md-button>
          } @else {
            <h2 class="step-title">Two-step verification</h2>
            <p class="step-copy">
              Enter the 6-digit code we sent to the phone ending in
              <strong>2418</strong>. Codes expire after 10 minutes.
            </p>

            <md-otp-field
              name="code"
              label="Verification code"
              required
              auto-submit
              value-missing-label="Enter the 6-digit code."
              incomplete-label="The code has 6 digits."
              supporting-text="Entering the last digit signs you in"
              reserve-supporting-space
            ></md-otp-field>

            <md-button variant="filled" type="submit" full-width>Verify and sign in</md-button>
            <div class="otp-actions">
              <md-button variant="text" type="button" (click)="phase.set('credentials')">Back</md-button>
              <md-button variant="text" type="button">Resend code</md-button>
            </div>
          }
        </md-card>
      </form>

      <p class="demo-note">
        Demo environment — any email and password continue, and any 6-digit code verifies.
      </p>
    </main>
  `,
  styles: [
    `
      .signin-wrap {
        display: grid;
        place-items: center;
        align-content: center;
        gap: 20px;
        min-block-size: 100dvh;
        padding: 24px;
        background:
          radial-gradient(
            1200px 500px at 50% -10%,
            var(--md-sys-color-primary-container),
            transparent
          ),
          var(--md-sys-color-surface);
      }
      .signin-form {
        inline-size: min(430px, 100%);
      }
      .signin-card {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 32px;
      }
      .brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin-block-end: 8px;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        inline-size: 48px;
        block-size: 48px;
        border-radius: var(--md-sys-shape-corner-full);
        background: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary);
        font: var(--md-sys-typescale-title-large-font);
      }
      .brand-name {
        margin: 8px 0 0;
        font: var(--md-sys-typescale-headline-small-font);
      }
      .brand-tag {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant);
        font: var(--md-sys-typescale-body-medium-font);
      }
      .step-title {
        margin: 0;
        font: var(--md-sys-typescale-title-large-font);
      }
      .step-copy {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant);
        font: var(--md-sys-typescale-body-medium-font);
      }
      .otp-actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .demo-note {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant);
        font: var(--md-sys-typescale-body-small-font);
        text-align: center;
      }
    `,
  ],
})
export class SignInComponent {
  private router = inject(Router);

  phase = signal<'credentials' | 'otp'>('credentials');

  onSubmit(event: Event) {
    event.preventDefault();
    if (this.phase() === 'credentials') {
      this.phase.set('otp');
    } else {
      this.router.navigateByUrl('/appointments');
    }
  }
}
