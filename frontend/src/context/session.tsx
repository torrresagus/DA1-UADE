/**
 * SessionContext — the client-side identity layer.
 *
 * Login calls POST /usuarios/login (server verifies email + bcrypt password).
 * The resolved user is persisted under a single AsyncStorage key so the app
 * re-hydrates on boot. The integer `usuario_id` is the identity for all
 * subsequent API calls.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loginUsuario, getUsuario } from '@/api/endpoints/usuarios';
import type { UsuarioOut } from '@/api/types';

const STORAGE_KEY = 'bidify.session';
const GUEST_KEY = 'bidify.guest';

export type SessionStatus = 'restoring' | 'authed' | 'anon';

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

type SessionValue = {
  usuario: UsuarioOut | null;
  usuarioId: number | null;
  status: SessionStatus;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<UsuarioOut>;
  /** Establish the session from an already-fetched user (e.g. after registration). */
  adoptUser: (usuario: UsuarioOut) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioOut | null>(null);
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [isGuest, setIsGuest] = useState(false);

  const persist = useCallback(async (u: UsuarioOut | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [raw, guestRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(GUEST_KEY),
        ]);
        if (!active) return;
        if (raw) {
          setUsuario(JSON.parse(raw) as UsuarioOut);
          setStatus('authed');
        } else {
          if (guestRaw === 'true') setIsGuest(true);
          setStatus('anon');
        }
      } catch {
        if (active) setStatus('anon');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const adoptUser = useCallback(
    async (u: UsuarioOut) => {
      setUsuario(u);
      setStatus('authed');
      setIsGuest(false);
      await Promise.all([persist(u), AsyncStorage.removeItem(GUEST_KEY)]);
    },
    [persist],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const found = await loginUsuario(email, password);
      await adoptUser(found);
      return found;
    },
    [adoptUser],
  );

  const logout = useCallback(async () => {
    setUsuario(null);
    setStatus('anon');
    setIsGuest(false);
    await Promise.all([persist(null), AsyncStorage.removeItem(GUEST_KEY)]);
  }, [persist]);

  const enterGuestMode = useCallback(async () => {
    setUsuario(null);
    setStatus('anon');
    setIsGuest(true);
    await AsyncStorage.setItem(GUEST_KEY, 'true');
  }, []);

  const exitGuestMode = useCallback(async () => {
    setIsGuest(false);
    await AsyncStorage.removeItem(GUEST_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!usuario) return;
    try {
      const fresh = await getUsuario(usuario.id);
      await adoptUser(fresh);
    } catch {
      // keep stale user on transient failure
    }
  }, [usuario, adoptUser]);

  const value = useMemo<SessionValue>(
    () => ({
      usuario,
      usuarioId: usuario?.id ?? null,
      status,
      isGuest,
      login,
      adoptUser,
      logout,
      refreshUser,
      enterGuestMode,
      exitGuestMode,
    }),
    [usuario, status, isGuest, login, adoptUser, logout, refreshUser, enterGuestMode, exitGuestMode],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
