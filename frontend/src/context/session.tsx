/**
 * SessionContext — the client-side identity layer.
 *
 * The backend has NO authentication: the integer `usuario_id` IS the identity.
 * "Login" can only look a user up by email (GET /usuarios) — no password is
 * ever verified server-side. We persist the resolved user under a single
 * AsyncStorage key so the app re-hydrates on boot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { findUsuarioByEmail, getUsuario } from '@/api/endpoints/usuarios';
import type { UsuarioOut } from '@/api/types';

const STORAGE_KEY = 'bidify.session';

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
  /** Resolve a user by email (password is cosmetic — no server verification exists). */
  login: (email: string, password: string) => Promise<UsuarioOut>;
  /** Establish the session from an already-fetched user (e.g. after registration). */
  adoptUser: (usuario: UsuarioOut) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioOut | null>(null);
  const [status, setStatus] = useState<SessionStatus>('restoring');

  const persist = useCallback(async (u: UsuarioOut | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (raw) {
          setUsuario(JSON.parse(raw) as UsuarioOut);
          setStatus('authed');
        } else {
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
      await persist(u);
    },
    [persist],
  );

  const login = useCallback(
    async (email: string, _password: string) => {
      const found = await findUsuarioByEmail(email);
      if (!found) {
        throw new AuthError('email_not_found', 'No existe una cuenta con ese email.');
      }
      await adoptUser(found);
      return found;
    },
    [adoptUser],
  );

  const logout = useCallback(async () => {
    setUsuario(null);
    setStatus('anon');
    await persist(null);
  }, [persist]);

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
      login,
      adoptUser,
      logout,
      refreshUser,
    }),
    [usuario, status, login, adoptUser, logout, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
