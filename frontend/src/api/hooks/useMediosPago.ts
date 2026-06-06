/**
 * React Query hooks for a usuario's medios de pago (payment methods) and
 * cuentas de cobro (collection accounts).
 *
 * Hooks receive the `usuarioId` as an argument — the screen passes
 * `session.usuarioId`. We never read AsyncStorage/session here. Queries that
 * need an id are gated on a finite positive id (and non-null where relevant);
 * mutations invalidate the affected keys on success.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as usuariosApi from '@/api/endpoints/usuarios';
import { queryClient, queryKeys } from '@/api/query-client';
import type { CuentaCobroOut, MedioPagoCreate, MedioPagoOut } from '@/api/types';

/** True when `id` is a usable backend identity. */
function isValidId(id: number | null): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** List the medios de pago for a usuario. Disabled until a valid id is known. */
export function useMediosPago(usuarioId: number | null) {
  return useQuery<MedioPagoOut[]>({
    queryKey: queryKeys.mediosPago(usuarioId ?? 0),
    queryFn: () => usuariosApi.listMediosPago(usuarioId as number),
    enabled: isValidId(usuarioId),
  });
}

/** Create a medio de pago for a usuario; refreshes that usuario's list. */
export function useCreateMedioPago(usuarioId: number) {
  return useMutation<MedioPagoOut, Error, MedioPagoCreate>({
    mutationFn: (body: MedioPagoCreate) => usuariosApi.createMedioPago(usuarioId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mediosPago(usuarioId) });
    },
  });
}

/** Delete a medio de pago for a usuario; refreshes that usuario's list. */
export function useDeleteMedioPago(usuarioId: number) {
  return useMutation<void, Error, number>({
    mutationFn: (mpId: number) => usuariosApi.deleteMedioPago(usuarioId, mpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mediosPago(usuarioId) });
    },
  });
}

/** List the cuentas de cobro for a usuario. Disabled until a valid id is known. */
export function useCuentasCobro(usuarioId: number | null) {
  return useQuery<CuentaCobroOut[]>({
    queryKey: queryKeys.cuentasCobro(usuarioId ?? 0),
    queryFn: () => usuariosApi.listCuentasCobro(usuarioId as number),
    enabled: isValidId(usuarioId),
  });
}
