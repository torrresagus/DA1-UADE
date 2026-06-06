/**
 * React Query hooks for Multas (fines).
 *
 * Screens pass ids explicitly (e.g. session.usuarioId); these hooks never read
 * AsyncStorage or session state directly.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as ventasApi from '@/api/endpoints/ventas';
import { queryClient, queryKeys } from '@/api/query-client';
import type { MultaOut } from '@/api/types';

/** True when an id is a usable positive numeric identifier. */
function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** All fines for a given user. Disabled until `usuarioId` is a valid id. */
export function useMultasUsuario(usuarioId: number | null) {
  return useQuery<MultaOut[]>({
    queryKey: queryKeys.multas(usuarioId as number),
    queryFn: () => ventasApi.listMultasUsuario(usuarioId as number),
    enabled: isValidId(usuarioId),
  });
}

/**
 * Count of unpaid fines for a user, derived from {@link useMultasUsuario}.
 * Returns a plain `number` (0 while loading or when there are no unpaid fines).
 */
export function useUnpaidMultaCount(usuarioId: number | null): number {
  const { data } = useMultasUsuario(usuarioId);
  return (data ?? []).filter((m) => !m.pagada).length;
}

/** Mutation to mark a fine as paid; invalidates the user's fines on success. */
export function usePagarMulta(usuarioId: number) {
  return useMutation<MultaOut, Error, number>({
    mutationFn: (multaId: number) => ventasApi.pagarMulta(multaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.multas(usuarioId) });
    },
  });
}
