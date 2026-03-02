import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  filter,
  map,
  switchMap,
  take,
  throwError,
} from 'rxjs';

import { AuthService } from '../services/auth/auth.service';
import { NotificationService } from '../services/ui/notification.service';
import { ApiResponse } from '../models/api.model';

// ── Module-level state shared across all interceptor invocations ─────────────

/** Whether a refresh request is already in-flight. */
let isRefreshing = false;

/**
 * Emits the new access token once the refresh completes.
 * Requests that arrive while a refresh is in-flight subscribe to this subject
 * and are replayed once a non-null value is emitted.
 */
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isApiEnvelope(body: unknown): body is ApiResponse<unknown> {
  return (
    body !== null &&
    typeof body === 'object' &&
    'status' in body &&
    'message' in body &&
    'data' in body
  );
}

/** Clone the request and attach the Bearer token header. */
function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Returns `true` for URLs that must NOT carry an access token.
 * NOTE: errors from these endpoints are still handled by the interceptor.
 */
function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

/** Extract a human-readable message from the error envelope. */
function extractMessage(error: HttpErrorResponse): string {
  return error.error?.message || error.message || 'An unexpected error occurred.';
}

// ── Interceptor ──────────────────────────────────────────────────────────────

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);

  // Attach the access token only for protected (non-auth) endpoints
  const token = isAuthEndpoint(req.url) ? null : authService.getAccessToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    // Transparently unwrap { status, message, data } envelopes so services
    // receive the flat payload they expect, with no per-service mapping needed.
    map((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse && isApiEnvelope(event.body)) {
        return event.clone({ body: event.body.data });
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) =>
      handleError(error, authReq, next, authService, router, notification)
    )
  );
};

// ── Global error handler ─────────────────────────────────────────────────────

function handleError(
  error: HttpErrorResponse,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  notification: NotificationService
) {
  // Network / CORS / server unreachable (status 0)
  if (error.status === 0) {
    notification.error('Cannot reach the server. Please check your connection.');
    return throwError(() => new Error('Cannot reach the server.'));
  }

  // 401 Unauthenticated
  if (error.status === 401) {
    // On public auth endpoints a 401 means wrong credentials (not an expired
    // session), so skip the refresh/redirect logic and just forward the message.
    if (isAuthEndpoint(req.url)) {
      return throwError(() => new Error(extractMessage(error)));
    }

    const code: string | undefined = error.error?.code;
    if (code === 'token_expired') {
      return handle401Refresh(req, next, authService, router, notification);
    }

    // token_invalid / no_token → tampered or missing; wipe session
    authService.clearSession();
    notification.error('Your session is invalid. Please log in again.');
    router.navigate(['/auth/login']);
    return throwError(() => new Error(extractMessage(error)));
  }

  // 403 Forbidden — authenticated but not authorised
  if (error.status === 403) {
    notification.error('You do not have permission to perform this action.');
    return throwError(() => new Error(extractMessage(error)));
  }

  // 429 Too Many Requests — rate limited by the server
  if (error.status === 429) {
    notification.error('Too many requests. Please wait a moment and try again.');
    return throwError(() => new Error(extractMessage(error)));
  }

  // 5xx Server errors
  if (error.status >= 500) {
    notification.error('A server error occurred. Please try again later.');
    return throwError(() => new Error(extractMessage(error)));
  }

  // 400, 404, 409 etc. — normalize and forward to the caller so components
  // can display field-level or contextual messages.
  return throwError(() => new Error(extractMessage(error)));
}

// ── Refresh-and-retry logic ──────────────────────────────────────────────────

function handle401Refresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  notification: NotificationService
) {
  if (!isRefreshing) {
    // ── First 401 triggers the refresh ──────────────────────────────────
    isRefreshing = true;
    refreshTokenSubject.next(null); // block queued requests

    return authService.refreshAccessToken().pipe(
      switchMap((tokens) => {
        isRefreshing = false;
        refreshTokenSubject.next(tokens.accessToken); // unblock queue
        return next(addToken(req, tokens.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        // The backend already rejected the refresh token (expired / revoked),
        // so just wipe localStorage — no need to hit POST /auth/logout again.
        authService.clearSession();
        notification.error('Your session has expired. Please log in again.');
        router.navigate(['/auth/login']);
        return throwError(() => err);
      })
    );
  }

  // ── Subsequent 401s wait for the first refresh to finish ────────────────
  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(addToken(req, token)))
  );
}
