import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasValidToken()) return true;

  if (authService.getRefreshToken()) {
    return authService.refreshAccessToken().pipe(
      map(() => true),
      catchError(() => {
        authService.clearSession();
        router.navigate(['/auth/login']);
        return of(false);
      })
    );
  }

  router.navigate(['/auth/login']);
  return false;
};
