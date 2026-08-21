import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

const NAV_PATHS = ['/appointments', '/lab-results', '/vitals'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (showChrome()) {
      <md-app-bar variant="small" headline="Caduceus Health" subtitle="Patient portal">
        <md-icon-button
          slot="trailing"
          icon="logout"
          aria-label="Sign out"
          (click)="signOut()"
        ></md-icon-button>
      </md-app-bar>
      <nav class="portal-nav">
        <md-navigation-bar
          aria-label="Portal sections"
          [attr.active-index]="activeIndex()"
          (mdChange)="onNav($event)"
        >
          <md-navigation-tab label="Appointments" icon="event"></md-navigation-tab>
          <md-navigation-tab label="Lab results" icon="science"></md-navigation-tab>
          <md-navigation-tab label="Vitals" icon="monitor_heart"></md-navigation-tab>
        </md-navigation-bar>
      </nav>
    }
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .portal-nav {
        border-block-end: 1px solid var(--md-sys-color-outline-variant);
        background: var(--md-sys-color-surface-container-low);
      }
    `,
  ],
})
export class AppComponent {
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  showChrome = computed(() => this.url() !== '/' && this.url() !== '');

  activeIndex = computed(() => {
    const current = this.url();
    const idx = NAV_PATHS.findIndex((p) => current.startsWith(p));
    return idx === -1 ? 0 : idx;
  });

  onNav(event: Event) {
    const index = (event as CustomEvent<{ index: number }>).detail.index;
    const target = NAV_PATHS[index];
    if (target && !this.url().startsWith(target)) {
      this.router.navigateByUrl(target);
    }
  }

  signOut() {
    this.router.navigateByUrl('/');
  }
}
