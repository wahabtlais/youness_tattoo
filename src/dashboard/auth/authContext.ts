import { createContext, useContext } from 'react';
import type { AuthState } from '@younes/contracts';

export interface StudioAuth {
  state: AuthState;
  /** ask the server again (after signing in, or a step of it) */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<StudioAuth | null>(null);

/** the signed-in owner (only rendered inside the gate, so always there) */
export function useStudioAuth(): StudioAuth {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useStudioAuth outside the AuthGate');
  return a;
}
