import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { ChatComponent } from './features/chat/chat.component';
import { SiteInspectionComponent } from './features/inspection/site-inspection.component';
import { ReportsComponent } from './features/reports/reports.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'chat',
        pathMatch: 'full',
      },
      {
        path: 'chat',
        component: ChatComponent,
      },
      {
        path: 'chat/:id',
        component: ChatComponent,
      },
      {
        path: 'inspection',
        component: SiteInspectionComponent,
      },
      {
        path: 'reports',
        component: ReportsComponent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
