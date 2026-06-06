/**
 * Pujas (bids) endpoints.
 *
 * Backend rules surface as ApiError(400) with a Spanish `detail` on POST /pujas
 * (e.g. monto below `minimo_proxima`); callers should show `err.detail`.
 */

import { apiFetch } from '@/api/client';
import type { PujaCreate, PujaOut, MejorOferta } from '@/api/types';

/** POST /pujas — register a new bid (201). Throws ApiError(400) on rule failure. */
export function crearPuja(body: PujaCreate): Promise<PujaOut> {
  return apiFetch<PujaOut>('/pujas', { method: 'POST', body });
}

/** GET /pujas/item/{id}/mejor — current best bid + next valid range for an item. */
export function getMejorOferta(catalogoItemId: number): Promise<MejorOferta> {
  return apiFetch<MejorOferta>(`/pujas/item/${catalogoItemId}/mejor`);
}

/** GET /pujas/item/{id} — all bids for a catalogo item, ASC (chronological). */
export function getPujasItem(catalogoItemId: number): Promise<PujaOut[]> {
  return apiFetch<PujaOut[]>(`/pujas/item/${catalogoItemId}`);
}

/** GET /pujas/usuario/{id} — all bids placed by a user, DESC (newest-first). */
export function getPujasUsuario(usuarioId: number): Promise<PujaOut[]> {
  return apiFetch<PujaOut[]>(`/pujas/usuario/${usuarioId}`);
}
