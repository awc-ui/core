import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, ViewEncapsulation, enableProdMode, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { mountEncore } from '../../../src/app.js';
import { ensureAwc } from '../../../src/runtime.js';

@Component({
  selector: 'encore-shell',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './shell.html',
  encapsulation: ViewEncapsulation.None,
})
class EncoreShell implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private dispose?: () => void;
  ngAfterViewInit() { this.dispose = mountEncore(this.host.nativeElement, { framework: 'angular' }); }
  ngOnDestroy() { this.dispose?.(); }
}
enableProdMode();
ensureAwc().then(() => bootstrapApplication(EncoreShell)).catch(console.error);
