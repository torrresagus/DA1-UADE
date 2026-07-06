/**
 * Subastas, catálogo y artículos endpoints (Sistema de Subastas API).
 *
 * Thin wrappers over `apiFetch`: build the path, pick method/body/query, and
 * return the typed result. No React / react-query here.
 */

import { apiFetch } from '@/api/client';
import type {
  ArticuloCreate,
  ArticuloOut,
  CatalogoItemCreate,
  CatalogoItemOut,
  EstadoSubasta,
  SubastaCambioEstado,
  SubastaOut,
  SubastaPublicaOut,
} from '@/api/types';

// ─── Subastas ─────────────────────────────────────────────────────────────

/**
 * GET /subastas — catálogo. `usuarioId` (registrado) trae los precios base;
 * sin él (invitado) el backend los omite. Optional `estado` filter.
 */
export function listSubastas(opts?: {
  estado?: EstadoSubasta;
  usuarioId?: number | null;
}): Promise<SubastaOut[]> {
  const query: Record<string, string | number> = {};
  if (opts?.estado) query.estado = opts.estado;
  if (opts?.usuarioId != null) query.usuario_id = opts.usuarioId;
  return apiFetch<SubastaOut[]>('/subastas', {
    query: Object.keys(query).length ? query : undefined,
  });
}

/** GET /subastas/publicas — public listing without prices. */
export function listSubastasPublicas(): Promise<SubastaPublicaOut[]> {
  return apiFetch<SubastaPublicaOut[]>('/subastas/publicas');
}

/**
 * GET /subastas/{id} — read a subasta. Pass `usuarioId` to trigger the
 * backend's 403 access check (categoría_minima); omit it to just read.
 */
export function getSubasta(id: number, opts?: { usuarioId?: number }): Promise<SubastaOut> {
  return apiFetch<SubastaOut>(`/subastas/${id}`, {
    query: opts?.usuarioId != null ? { usuario_id: opts.usuarioId } : undefined,
  });
}

/** POST /subastas/{id}/estado — transition subasta state. */
export function cambiarEstadoSubasta(
  id: number,
  body: SubastaCambioEstado,
): Promise<SubastaOut> {
  return apiFetch<SubastaOut>(`/subastas/${id}/estado`, { method: 'POST', body });
}

// ─── Catálogo ─────────────────────────────────────────────────────────────

/** GET /subastas/{subastaId}/catalogo — catálogo items for a subasta. */
export function getCatalogo(subastaId: number): Promise<CatalogoItemOut[]> {
  return apiFetch<CatalogoItemOut[]>(`/subastas/${subastaId}/catalogo`);
}

/** POST /subastas/{subastaId}/catalogo — add an item to the catálogo. */
export function addCatalogoItem(
  subastaId: number,
  body: CatalogoItemCreate,
): Promise<CatalogoItemOut> {
  return apiFetch<CatalogoItemOut>(`/subastas/${subastaId}/catalogo`, { method: 'POST', body });
}

// ─── Artículos ────────────────────────────────────────────────────────────

/** GET /articulos/{id} — single artículo. */
export function getArticulo(id: number): Promise<ArticuloOut> {
  return apiFetch<ArticuloOut>(`/articulos/${id}`);
}

/** GET /articulos — all artículos. */
export function listArticulos(): Promise<ArticuloOut[]> {
  return apiFetch<ArticuloOut[]>('/articulos');
}

/** POST /articulos — create an artículo. */
export function createArticulo(body: ArticuloCreate): Promise<ArticuloOut> {
  return apiFetch<ArticuloOut>('/articulos', { method: 'POST', body });
}
