import { Routes } from '@angular/router';
import { SignInComponent } from './pages/sign-in.component';
import { AppointmentsComponent } from './pages/appointments.component';
import { LabResultsComponent } from './pages/lab-results.component';
import { VitalsComponent } from './pages/vitals.component';

export const routes: Routes = [
  { path: '', component: SignInComponent, title: 'Sign in — Caduceus Health' },
  { path: 'appointments', component: AppointmentsComponent, title: 'Appointments — Caduceus Health' },
  { path: 'lab-results', component: LabResultsComponent, title: 'Lab results — Caduceus Health' },
  { path: 'vitals', component: VitalsComponent, title: 'Vitals — Caduceus Health' },
];
