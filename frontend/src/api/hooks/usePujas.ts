/**
 * React Query hooks for pujas (bids): live room, bid-confirmation, history.
 *
 * Bid rules surface from the backend as `ApiError(400)` with a Spanish `detail`
 * (e.g. monto below `minimo_proxima`). `useCrearPuja` does NOT swallow these —
 * the caller reads `mutation.error` as `ApiError` and shows `error.detail`
 * verbatim. Ids are passed in as arguments (the screen supplies
 * `session.usuarioId`); these hooks never touch AsyncStorage or session.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as pujasApi from '@/api/endpoints/pujas';
import * as ventasApi from '@/api/endpoints/ventas';
import { queryClient, queryKeys } from '@/api/query-client';
import type { PujaOut, VentaOut } from '@/api/types';

/** Whether an id is a usable (positive, finite) backend id. */
function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** Variables for placing a bid. */
export interface CrearPujaVars {
  catalogo_item_id: number;
  usuario_id: number;
  monto: number;
  retira_personalmente?: boolean;
  /** Medio de pago con el que cancelaría si gana. */
  medio_pago_id?: number | null;
}

/**
 * Place a bid (live room / bid-confirmation flow).
 *
 * On failure the rejected promise carries an `ApiError` whose `detail` is the
 * backend's Spanish rule message — surface it verbatim. On success it
 * invalidates the item's best offer, the item's bid list, and the bidder's
 * own bid history so dependent screens refetch.
 */
export function useCrearPuja() {
  return useMutation<PujaOut, unknown, CrearPujaVars>({
    mutationFn: (vars) => pujasApi.crearPuja(vars),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mejor(vars.catalogo_item_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pujasItem(vars.catalogo_item_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pujasUsuario(vars.usuario_id) });
    },
  });
}

/**
 * All bids placed by a user (newest-first), for the user's bid history.
 * Disabled until `usuarioId` is a valid positive number.
 */
export function usePujasUsuario(usuarioId: number | null) {
  return useQuery<PujaOut[]>({
    queryKey: queryKeys.pujasUsuario(usuarioId ?? 0),
    queryFn: () => pujasApi.getPujasUsuario(usuarioId as number),
    enabled: isValidId(usuarioId),
  });
}

/** Status of a user's bid relative to the realized sales. */
export type BidStatus = 'won' | 'lost' | 'active';

/** A single row of the bid-history view-model. */
export interface BidHistoryItem {
  puja: PujaOut;
  status: BidStatus;
  venta?: VentaOut;
}

/**
 * Bid-history view-model: cross-references the user's bids with realized sales.
 *
 * In its `queryFn` it fetches the user's bids and the global sales list in
 * parallel, then computes a status per bid:
 *   - 'won'    if a sale exists where comprador_id === usuarioId AND the sale's
 *              catalogo_item_id matches the bid's catalogo_item_id;
 *   - 'lost'   else if a sale exists for that catalogo_item_id with a different
 *              buyer;
 *   - 'active' otherwise (item not yet sold).
 *
 * Title resolution is out of scope (the screen can render
 * 'Lote #<catalogo_item_id>'). Disabled until `usuarioId` is valid.
 */
export function useBidHistoryVM(usuarioId: number | null) {
  return useQuery<BidHistoryItem[]>({
    queryKey: [...queryKeys.pujasUsuario(usuarioId ?? 0), 'history-vm'] as const,
    enabled: isValidId(usuarioId),
    queryFn: async () => {
      const uid = usuarioId as number;
      const [pujas, ventas] = await Promise.all([
        pujasApi.getPujasUsuario(uid),
        ventasApi.listVentas(),
      ]);

      return pujas.map((puja): BidHistoryItem => {
        const ventasItem = ventas.filter(
          (v) => v.catalogo_item_id === puja.catalogo_item_id,
        );
        const won = ventasItem.find((v) => v.comprador_id === uid);
        if (won) return { puja, status: 'won', venta: won };
        if (ventasItem.length > 0) return { puja, status: 'lost', venta: ventasItem[0] };
        return { puja, status: 'active' };
      });
    },
  });
}
