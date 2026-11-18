import { Routes } from '@angular/router';
import { SiteInspectionComponent } from './features/inspection/site-inspection.component';
import { LoginComponent } from './features/auth/login.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'inspection',
    component: SiteInspectionComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
