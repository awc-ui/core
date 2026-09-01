import { Injectable, signal } from '@angular/core';

/**
 * State that belongs to the FRAME rather than to a screen, and therefore has to
 * outlive one.
 *
 * The React build holds this in a `ShellProvider` mounted above its router; in
 * Angular a root-provided service is the same thing — the routed screens come
 * and go beneath `AppComponent`'s chrome, and this singleton is never
 * re-created.
 *
 * Only the rail's expansion lives here today. Resist adding screen state to it:
 * a screen's filters SHOULD reset when you leave the screen, and the routed
 * component being destroyed on navigation is exactly the mechanism that makes
 * them.
 */
@Injectable({ providedIn: 'root' })
export class ShellService {
  // Collapsed by default: the rail's labels cost 140px of the width a
  // twelve-column holdings table wants, and the icons plus the active indicator
  // already say where you are.
  private readonly expanded = signal(false);

  readonly railExpanded = this.expanded.asReadonly();

  toggleRail(): void {
    this.expanded.update((open) => !open);
  }
}
