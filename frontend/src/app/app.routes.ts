import { Routes } from '@angular/router';
import { SiteInspectionComponent } from './features/inspection/site-inspection.component';

export const routes: Routes = [
  {
    path: 'inspection',
    component: SiteInspectionComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];


