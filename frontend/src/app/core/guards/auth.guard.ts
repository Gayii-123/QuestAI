import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Prevents unauthenticated or unauthorized users from accessing protected QuestAI routes.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthChecking()) {
    await authService.authReadyPromise;
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Prevents already authenticated users from seeing the login page again.
 */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthChecking()) {
    await authService.authReadyPromise;
  }

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
