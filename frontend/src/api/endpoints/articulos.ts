/**
 * Artículos, seguros y depósitos (Sistema de Subastas API).
 *
 *   GET  /articulos/{id}                 -> ArticuloOut
 *   GET  /seguros?beneficiario_id={id}   -> SeguroOut[]
 *   POST /seguros/{id}/aumentar          -> SeguroOut
 *   GET  /depositos/{id}                 -> DepositoOut
 */

import { apiFetch } from '@/api/client';
import type { ArticuloOut, DepositoOut, SeguroOut } from '@/api/types';

/** A single artículo (pieza) by id. */
export function getArticulo(articuloId: number): Promise<ArticuloOut> {
  return apiFetch<ArticuloOut>(`/articulos/${articuloId}`);
}

/** Policies whose beneficiary is the given user. */
export function listSeguros(beneficiarioId: number): Promise<SeguroOut[]> {
  return apiFetch<SeguroOut[]>('/seguros', { query: { beneficiario_id: beneficiarioId } });
}

/** Increase a policy's covered amount (pays the premium difference). */
export function aumentarSeguro(seguroId: number, nuevoMonto: number): Promise<SeguroOut> {
  return apiFetch<SeguroOut>(`/seguros/${seguroId}/aumentar`, {
    method: 'POST',
    body: { nuevo_monto: nuevoMonto },
  });
}

/** A single depósito (warehouse) by id. */
export function getDeposito(depositoId: number): Promise<DepositoOut> {
  return apiFetch<DepositoOut>(`/depositos/${depositoId}`);
}
