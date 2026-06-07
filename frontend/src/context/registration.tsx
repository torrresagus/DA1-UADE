/**
 * RegistrationContext — ephemeral (non-persisted) carrier for the 2-screen
 * registration flow, because the backend is a 3-step state machine:
 *   etapa-1  ->  (admin) aprobacion  ->  etapa-2 (password)
 *
 * register-account submits etapa-1 and stashes the new usuario_id + password;
 * register-finish calls finish() which runs etapa-2, transparently inserting
 * the aprobacion step when EXPO_PUBLIC_AUTO_APPROVE is enabled (default in dev),
 * since etapa-2 otherwise 409s while the user is PENDIENTE_VERIFICACION.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { aprobacion, registroEtapa1, registroEtapa2 } from '@/api/endpoints/usuarios';
import type { UsuarioOut } from '@/api/types';

const AUTO_APPROVE = process.env.EXPO_PUBLIC_AUTO_APPROVE !== 'false';

export type RegistrationDraft = {
  usuarioId: number;
  nombre: string;
  apellido: string;
  email: string;
} | null;

export type Step1Input = {
  nombre: string;
  apellido: string;
  email: string;
  domicilio: string;
  pais: string;
  docFrenteUrl?: string | null;
  docDorsoUrl?: string | null;
};

type RegistrationValue = {
  draft: RegistrationDraft;
  submitStep1: (input: Step1Input) => Promise<UsuarioOut>;
  // The personal password is generated in etapa-2 (per the enunciado), so it is
  // collected on the finish screen and passed in here — not stored in the draft.
  finish: (password: string) => Promise<UsuarioOut>;
  clear: () => void;
};

const RegistrationContext = createContext<RegistrationValue | null>(null);

export function RegistrationProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(null);

  const submitStep1 = useCallback(async (input: Step1Input) => {
    const user = await registroEtapa1({
      nombre: input.nombre,
      apellido: input.apellido,
      email: input.email,
      domicilio: input.domicilio,
      pais: input.pais,
      doc_frente_url: input.docFrenteUrl ?? null,
      doc_dorso_url: input.docDorsoUrl ?? null,
    });
    setDraft({
      usuarioId: user.id,
      nombre: input.nombre,
      apellido: input.apellido,
      email: input.email,
    });
    return user;
  }, []);

  const finish = useCallback(
    async (password: string) => {
      if (!draft) throw new Error('No hay un registro en curso.');
      try {
        return await registroEtapa2(draft.usuarioId, { password });
      } catch (e) {
        const is409 = e instanceof ApiError && e.status === 409;
        if (is409 && AUTO_APPROVE) {
          // Dev shim: perform the manual company approval, then retry etapa-2.
          await aprobacion(draft.usuarioId, { categoria: 'comun' });
          return await registroEtapa2(draft.usuarioId, { password });
        }
        throw e;
      }
    },
    [draft],
  );

  const clear = useCallback(() => setDraft(null), []);

  const value = useMemo<RegistrationValue>(
    () => ({ draft, submitStep1, finish, clear }),
    [draft, submitStep1, finish, clear],
  );

  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistration(): RegistrationValue {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error('useRegistration must be used within a RegistrationProvider');
  return ctx;
}
