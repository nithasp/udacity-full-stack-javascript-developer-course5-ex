import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Case 1: Access token is valid → allow immediately (no network call needed)
  if (authService.hasValidToken()) {
    return true;
  }

  // Case 2: Access token expired/missing but a refresh token is stored →
  // make a real server-side call to verify the refresh token is still valid.
  // This is the only way to know whether the session is truly alive,
  // because the refresh token could also be expired or revoked in the DB.
  if (authService.getRefreshToken()) {
    return authService.refreshAccessToken().pipe(
      map(() => true),               // refresh succeeded → allow navigation
      catchError(() => {             // refresh failed (expired / revoked)
        authService.clearSession();  // wipe localStorage without hitting backend again
        router.navigate(['/auth/login']);
        return of(false);
      })
    );
  }

  // Case 3: No session at all → redirect to login
  router.navigate(['/auth/login']);
  return false;
};
