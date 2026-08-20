import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AwcUiModule } from '@awc-ui/angular';

/**
 * Reactive-forms binding check for the AWC UI ControlValueAccessors.
 *
 * This is the case that did NOT work before the accessors existed: Angular had
 * no way to read or write a custom element's value, so `formControlName` bound
 * to nothing regardless of how well the element behaved natively.
 *
 * Renders the live model as JSON so an e2e check can assert the binding really
 * round-trips rather than merely compiling.
 */
@Component({
  selector: 'app-reactive-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AwcUiModule],
  template: `
    <form [formGroup]="form" data-reactive-form>
      <md-text-field formControlName="name" label="Name" variant="outlined"></md-text-field>

      <md-select formControlName="country" label="Country" variant="outlined">
        <md-select-option value="pt">Portugal</md-select-option>
        <md-select-option value="ro">Romania</md-select-option>
      </md-select>

      <md-checkbox formControlName="terms">Accept</md-checkbox>
      <!-- md-switch binds through its selected property, not checked -->
      <md-switch formControlName="newsletter"></md-switch>
      <md-rating formControlName="score"></md-rating>

      <button type="button" data-patch (click)="patch()">patch from model</button>

      <pre data-model>{{ form.value | json }}</pre>
      <pre data-status>{{ form.valid ? 'VALID' : 'INVALID' }}</pre>
    </form>
  `,
})
export class ReactiveFormComponent {
  private fb = new FormBuilder();

  /** Exercises the WRITE direction: model -> element (ControlValueAccessor.writeValue). */
  patch() {
    this.form.patchValue({
      name: 'From model',
      country: 'pt',
      terms: true,
      newsletter: true,
      score: 5,
    });
  }

  form = this.fb.group({
    name: ['', Validators.required],
    country: [''],
    terms: [false],
    newsletter: [false],
    score: [0],
  });
}
