import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthApiService, AuthUser, AuthResponse, RefreshResponse } from './auth-api.service';

// Re-export so all existing consumers keep their imports unchanged
export type { AuthUser, AuthResponse, RefreshResponse };

// ── Constants ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedInSubject = new BehaviorSubject<boolean>(this.hasValidToken());
  isLoggedIn$ = this.loggedInSubject.asObservable();

  /**
   * Emits the current user, or null when logged out.
   * Seeded from the cached server response in localStorage so the navbar
   * renders immediately on page refresh; replaced by the live /auth/me
   * response once fetchCurrentUser() resolves.
   */
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(
    this.getCachedUser()
  );
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private authApi: AuthApiService) {}

  // ── Token helpers ──────────────────────────────────────────────────────────

  /** True if the stored access token exists, is well-formed, and not expired. */
  hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const header = JSON.parse(atob(parts[0]));
      if (!header.alg || !header.typ) return false;

      const payload = JSON.parse(atob(parts[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /** Read the user object that was cached from the last login/register response. */
  private getCachedUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.getValue();
  }

  /**
   * Fetch the authenticated user's profile from the server and update
   * currentUser$. Call this once on app init (when already logged in) so the
   * displayed username always reflects the real database value.
   */
  fetchCurrentUser(): Observable<AuthUser> {
    return this.authApi.fetchMe().pipe(
      tap((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((err) => throwError(() => err))
    );
  }

  // ── Session helpers ────────────────────────────────────────────────────────

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.loggedInSubject.next(true);
    this.currentUserSubject.next(response.user);
  }

  private storeRefreshedTokens(response: RefreshResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    this.loggedInSubject.next(true);
  }

  // ── Auth operations ────────────────────────────────────────────────────────

  register(username: string, password: string): Observable<AuthResponse> {
    return this.authApi
      .register(username, password)
      .pipe(tap((res) => this.storeSession(res)));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.authApi
      .login(username, password)
      .pipe(tap((res) => this.storeSession(res)));
  }

  /**
   * Exchange the stored refresh token for a new access + refresh token pair.
   * Pure operation — no side effects on failure.
   * Callers are responsible for calling logout() / clearSession() on error.
   */
  refreshAccessToken(): Observable<RefreshResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.authApi
      .refresh(refreshToken)
      .pipe(tap((res) => this.storeRefreshedTokens(res)));
  }

  /**
   * Full logout: tell the backend to delete the refresh token from the DB,
   * then wipe local storage.
   * Use this from user-initiated logout or when the interceptor detects
   * a failed refresh (the refresh token is still in localStorage at that point).
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.authApi.logout(refreshToken).subscribe({ error: () => {} });
    }
    this.clearSession();
  }

  /**
   * Wipe local session data without notifying the backend.
   * Use this when the backend has already invalidated the token
   * (e.g. after a failed refresh in the auth guard — the backend already
   * rejected it, so there is no valid token to delete).
   */
  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.loggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }
}
