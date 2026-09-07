import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, ViewEncapsulation, enableProdMode, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { mountFrame } from '../../../src/app.js';
import { ensureAwc } from '../../../src/runtime.js';

@Component({
  selector: 'frame-shell',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './shell.html',
  encapsulation: ViewEncapsulation.None,
})
class FrameShell implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private dispose?: () => void;
  ngAfterViewInit() { this.dispose = mountFrame(this.host.nativeElement, { framework: 'angular' }); }
  ngOnDestroy() { this.dispose?.(); }
}
enableProdMode();
ensureAwc().then(() => bootstrapApplication(FrameShell)).catch(console.error);
