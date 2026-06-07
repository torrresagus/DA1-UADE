/**
 * React Query hooks for seguros (insurance policies) and depósitos (warehouses).
 *
 * Screens pass the usuarioId explicitly; these hooks never read session state.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as articulosApi from '@/api/endpoints/articulos';
import { queryClient, queryKeys } from '@/api/query-client';
import type { ArticuloOut, DepositoOut, SeguroOut } from '@/api/types';

function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** Policies where the given user is the beneficiary. */
export function useSeguros(beneficiarioId: number | null) {
  return useQuery<SeguroOut[]>({
    queryKey: queryKeys.seguros(beneficiarioId ?? 0),
    queryFn: () => articulosApi.listSeguros(beneficiarioId as number),
    enabled: isValidId(beneficiarioId),
  });
}

/** A single warehouse by id (for showing a piece's location). */
export function useDeposito(depositoId: number | null) {
  return useQuery<DepositoOut>({
    queryKey: queryKeys.deposito(depositoId ?? 0),
    queryFn: () => articulosApi.getDeposito(depositoId as number),
    enabled: isValidId(depositoId),
  });
}

/** A single artículo by id (to resolve a policy's covered piece + its depósito). */
export function useArticulo(articuloId: number | null) {
  return useQuery<ArticuloOut>({
    queryKey: queryKeys.articulo(articuloId ?? 0),
    queryFn: () => articulosApi.getArticulo(articuloId as number),
    enabled: isValidId(articuloId),
  });
}

/** Increase a policy's covered amount; refreshes the beneficiary's policies. */
export function useAumentarSeguro(beneficiarioId: number) {
  return useMutation<SeguroOut, Error, { seguroId: number; nuevoMonto: number }>({
    mutationFn: ({ seguroId, nuevoMonto }) => articulosApi.aumentarSeguro(seguroId, nuevoMonto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seguros(beneficiarioId) });
    },
  });
}
