/**
 * React Query hooks for the auction Home list and lot detail/live views.
 *
 * The backend is auction-centric (a Subasta owns a `catalogo` of CatalogoItem),
 * but the UI is lot-centric (a card == one CatalogoItem). These hooks fetch the
 * raw backend shapes and lean on the pure adapters to flatten/join into VMs.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-client';
import * as subastasApi from '@/api/endpoints/subastas';
import * as pujasApi from '@/api/endpoints/pujas';
import {
  toLotCards,
  toAuctionDetailVM,
  type ArticulosIndex,
  type AuctionDetailVM,
} from '@/api/adapters';
import type { Auction } from '@/components/auction-card';
import type { CategoriaUsuario } from '@/api/types';

/** A near-live refetch cadence for the bid-sensitive detail queries (ms). */
const LIVE_REFETCH_MS = 5000;

/**
 * Home list of lot cards.
 *
 * Fetches the full subastas tree and the articulos catalog in parallel, indexes
 * articulos by id (images/title live only on Articulo), and flattens every
 * subasta's catalogo into Auction cards.
 *
 * LAZY-MEJOR DECISION: we deliberately pass an EMPTY mejorByItemId here. The
 * "current best bid" per item requires a separate GET /pujas/item/{id}/mejor
 * call, and fetching it for every card on Home would be an O(n) fan-out (one
 * request per lot) that hammers the API and slows first paint. Cards instead
 * fall back to each item's precio_base (handled inside toLotCards), and the
 * live best offer is fetched on demand by useMejorOferta on the detail screen.
 */
export function useAuctions(
  opts: { usuarioCategoria?: CategoriaUsuario | null; usuarioId?: number | null } = {},
) {
  const { usuarioCategoria, usuarioId } = opts;
  return useQuery<Auction[]>({
    // Separate cache for guest (no prices) vs registered (prices).
    queryKey: queryKeys.lots(usuarioId != null ? `u${usuarioId}` : 'guest'),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [subastas, articulos] = await Promise.all([
        subastasApi.listSubastas({ usuarioId }),
        subastasApi.listArticulos(),
      ]);

      const articulosById: ArticulosIndex = {};
      for (const articulo of articulos) {
        articulosById[articulo.id] = articulo;
      }

      // Empty mejor index on purpose — see LAZY-MEJOR note in the docblock.
      return toLotCards(subastas, articulosById, {}, usuarioCategoria);
    },
  });
}

/**
 * Detail view-model for a single lot (CatalogoItem).
 *
 * Locates the owning subasta + catalogo item by scanning the subastas tree for
 * the given catalogoItemId, then fetches the item's articulo and current best
 * offer in parallel and joins them into the detail VM.
 */
export function useAuctionDetail(
  catalogoItemId: number,
  usuarioCategoria?: CategoriaUsuario | null,
  usuarioId?: number | null,
) {
  return useQuery<AuctionDetailVM>({
    queryKey: [...queryKeys.lot(catalogoItemId), usuarioId != null ? `u${usuarioId}` : 'guest'],
    enabled: Number.isFinite(catalogoItemId) && catalogoItemId > 0,
    refetchInterval: LIVE_REFETCH_MS,
    queryFn: async () => {
      const subastas = await subastasApi.listSubastas({ usuarioId });

      let subasta: (typeof subastas)[number] | undefined;
      let item: (typeof subastas)[number]['catalogo'][number] | undefined;
      for (const s of subastas) {
        const found = (s.catalogo ?? []).find((c) => c.id === catalogoItemId);
        if (found) {
          subasta = s;
          item = found;
          break;
        }
      }

      if (!subasta || !item) {
        throw new Error(`Lote #${catalogoItemId} no encontrado`);
      }

      const [articulo, mejor] = await Promise.all([
        subastasApi.getArticulo(item.articulo_id),
        pujasApi.getMejorOferta(catalogoItemId),
      ]);

      return toAuctionDetailVM(subasta, item, articulo, mejor, usuarioCategoria);
    },
  });
}

/**
 * Current best offer + next valid bid range for an item. Near-live: refetches
 * every 5s so the bid screen reflects competing bids without a manual reload.
 */
export function useMejorOferta(catalogoItemId: number) {
  return useQuery({
    queryKey: queryKeys.mejor(catalogoItemId),
    enabled: Number.isFinite(catalogoItemId) && catalogoItemId > 0,
    queryFn: () => pujasApi.getMejorOferta(catalogoItemId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

/**
 * Chronological bid history for an item. Near-live: refetches every 5s so the
 * live history list grows as bids arrive.
 */
export function usePujasItem(catalogoItemId: number) {
  return useQuery({
    queryKey: queryKeys.pujasItem(catalogoItemId),
    enabled: Number.isFinite(catalogoItemId) && catalogoItemId > 0,
    queryFn: () => pujasApi.getPujasItem(catalogoItemId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}
