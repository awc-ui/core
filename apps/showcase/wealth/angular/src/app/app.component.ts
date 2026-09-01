import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppBarComponent } from './components/app-bar.component';
import { BarComponent } from './components/bar.component';
import { DockComponent } from './components/dock.component';
import { RailComponent } from './components/rail.component';

/**
 * The chrome that OUTLIVES navigation.
 *
 * The router swaps a different screen component into the outlet on every
 * navigation, so everything a screen renders is destroyed and rebuilt on each
 * click. The app bar, the rail and the bottom bar therefore live HERE, above
 * the outlet — the React build's `AppFrame` — so they are the SAME elements
 * across a navigation: the rail's active indicator has something to animate
 * from, its expand/collapse width transition actually runs, and its expansion
 * state (`ShellService`) is never reset by a route change.
 *
 * `:host { display: contents }`: the shell is a full-height flex column and
 * `<awc-showcase-dock>` is its sibling, and both must be laid out against the
 * viewport rather than against this host element — the same reason the React
 * build's `#root` carries an inline `display: contents`.
 */
@Component({
  selector: 'awc-root',
  standalone: true,
  imports: [RouterOutlet, AppBarComponent, RailComponent, BarComponent, DockComponent],
  styles: ':host { display: contents; }',
  template: `
    <div class="shell">
      <awc-app-bar />

      <div class="shell__body">
        <awc-rail />

        <main class="shell__main"><router-outlet /></main>
      </div>

      <awc-bar />
    </div>
    <awc-dock />
  `,
})
export class AppComponent {}
