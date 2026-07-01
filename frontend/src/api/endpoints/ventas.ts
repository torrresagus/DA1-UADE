/**
 * Ventas & Multas endpoints (Sistema de Subastas API).
 *
 * Sales:
 *   GET  /ventas                         -> VentaOut[]
 *   GET  /ventas/{id}                    -> VentaOut
 *   POST /ventas/{id}/pagar              -> VentaOut
 *   POST /ventas/cerrar/{catalogoItemId} -> VentaOut   (admin)
 *   POST /ventas/{id}/impago            -> { multa_id, monto, bloqueado } (admin)
 *
 * Fines:
 *   POST /multas                         (MultaCreate) -> MultaOut (201)
 *   GET  /multas/usuario/{usuarioId}     -> MultaOut[]
 *   POST /multas/{id}/pagar              -> MultaOut
 */

import { apiFetch } from '@/api/client';
import type { VentaOut, MultaOut, MultaCreate } from '@/api/types';

/** All sales. */
export function listVentas(): Promise<VentaOut[]> {
  return apiFetch<VentaOut[]>('/ventas');
}

/** Sales where the given user is the buyer. */
export function getVentasUsuario(usuarioId: number): Promise<VentaOut[]> {
  return apiFetch<VentaOut[]>(`/ventas/usuario/${usuarioId}`);
}

/** A single sale by id. */
export function getVenta(id: number): Promise<VentaOut> {
  return apiFetch<VentaOut>(`/ventas/${id}`);
}

/** Mark a sale as paid (buyer settles the sale). */
export function pagarVenta(id: number): Promise<VentaOut> {
  return apiFetch<VentaOut>(`/ventas/${id}/pagar`, { method: 'POST' });
}

/** All fines for a given user. */
export function listMultasUsuario(usuarioId: number): Promise<MultaOut[]> {
  return apiFetch<MultaOut[]>(`/multas/usuario/${usuarioId}`);
}

/** Mark a fine as paid. */
export function pagarMulta(multaId: number): Promise<MultaOut> {
  return apiFetch<MultaOut>(`/multas/${multaId}/pagar`, { method: 'POST' });
}

/** Create a fine. */
export function crearMulta(body: MultaCreate): Promise<MultaOut> {
  return apiFetch<MultaOut>('/multas', { method: 'POST', body });
}

/* ---- admin helpers ---- */

/** Admin: close a won catalogo item into a sale (computes commission, shipping). */
export function cerrarVenta(
  catalogoItemId: number,
  body?: { medio_pago_id?: number; comision_pct?: number; costo_envio?: number },
): Promise<VentaOut> {
  return apiFetch<VentaOut>(`/ventas/cerrar/${catalogoItemId}`, { method: 'POST', body });
}

/** Admin: register a sale as unpaid -> generates a fine and may block the user. */
export function registrarImpago(
  ventaId: number,
): Promise<{ multa_id: number; monto: number; bloqueado: boolean }> {
  return apiFetch<{ multa_id: number; monto: number; bloqueado: boolean }>(
    `/ventas/${ventaId}/impago`,
    { method: 'POST' },
  );
}
