import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import type { AuthState } from '@younes/contracts';
import { api, errorText, whenSignedOut } from '../api';
import { AuthContext } from './authContext';
import { AuthFrame, EnrollScreen, LoginScreen, ResetScreen, SetupScreen, VerifyScreen } from './AuthScreens';

/**
 * The studio's door. It asks the server where the visitor stands
 * (/api/auth/state) and shows only what fits: the one-time owner setup, the
 * sign-in, setting up the authenticator (required before anything else),
 * the code at each sign-in - and the studio itself only once the server
 * says the session has passed both steps. This is the interface, not the
 * protection: every private request is checked by the server regardless.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [state, setState] = useState<AuthState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await api<AuthState>('/api/auth/state'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    api<AuthState>('/api/auth/state').then(setState, (e) => setError(errorText(e)));
    // a request that finds the session gone (expired, revoked elsewhere) brings the sign-in back
    whenSignedOut(() => void refresh());
    return () => whenSignedOut(null);
  }, [refresh]);

  const value = useMemo(() => (state ? { state, refresh, signOut } : null), [state, refresh, signOut]);

  // a reset link works signed out
  if (pathname === '/studio/reset') return <ResetScreen onDone={refresh} />;
  if (error && !state)
    return (
      <AuthFrame title="The studio can’t be reached">
        <p className="text-[0.9375rem] leading-snug text-ink-soft">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-4 inline-flex h-10 items-center rounded-(--studio-r-md) border border-(--studio-line-strong) px-4 text-[0.875rem] font-semibold text-ink hover:bg-(--studio-hover)">
          Try again
        </button>
      </AuthFrame>
    );
  if (!state || !value) return <AuthFrame title="Opening the studio…" />;
  if (state.setupRequired) return <SetupScreen onDone={refresh} />;
  if (!state.user) return <LoginScreen onDone={refresh} />;
  if (state.mfa === 'enroll') return <EnrollScreen onDone={refresh} onCancel={signOut} />;
  if (state.mfa === 'verify') return <VerifyScreen onDone={refresh} onCancel={signOut} />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
