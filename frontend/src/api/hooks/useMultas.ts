/**
 * React Query hooks for Multas (fines).
 *
 * Screens pass ids explicitly (e.g. session.usuarioId); these hooks never read
 * AsyncStorage or session state directly.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as ventasApi from '@/api/endpoints/ventas';
import { queryClient, queryKeys } from '@/api/query-client';
import type { MultaOut, VentaOut } from '@/api/types';

/** True when an id is a usable positive numeric identifier. */
function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** All fines for a given user. Polls every 10 s so new auto-generated fines appear in real time. */
export function useMultasUsuario(usuarioId: number | null) {
  return useQuery<MultaOut[]>({
    queryKey: queryKeys.multas(usuarioId as number),
    queryFn: () => ventasApi.listMultasUsuario(usuarioId as number),
    enabled: isValidId(usuarioId),
    refetchInterval: 10000,
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

/** Sales where the given user is the buyer. Polls every 15s to pick up auto-generated sales. */
export function useVentasUsuario(usuarioId: number | null) {
  return useQuery<VentaOut[]>({
    queryKey: queryKeys.ventasUsuario(usuarioId as number),
    queryFn: () => ventasApi.getVentasUsuario(usuarioId as number),
    enabled: isValidId(usuarioId),
    refetchInterval: 15_000,
  });
}

/** Mutation to mark a sale as paid; invalidates ventas and multas on success. */
export function usePagarVenta(usuarioId: number) {
  return useMutation<VentaOut, Error, number>({
    mutationFn: (ventaId: number) => ventasApi.pagarVenta(ventaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventasUsuario(usuarioId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.multas(usuarioId) });
    },
  });
}
