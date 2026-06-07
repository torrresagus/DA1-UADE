/**
 * Solicitudes endpoints (Sistema de Subastas API).
 *
 *   POST /solicitudes/{usuarioId}        (SolicitudCreate)     -> SolicitudOut (201)
 *   GET  /solicitudes/{id}                                     -> SolicitudOut
 *   GET  /solicitudes                                          -> SolicitudOut[]
 *   POST /solicitudes/{id}/resolver      (SolicitudResolucion) -> SolicitudOut
 */

import { apiFetch } from '@/api/client';
import type {
  EstadoSolicitud,
  SolicitudCreate,
  SolicitudOut,
  SolicitudResolucion,
} from '@/api/types';

/** Create a new solicitud (consignment request) for the given user. */
export function crearSolicitud(usuarioId: number, body: SolicitudCreate): Promise<SolicitudOut> {
  return apiFetch<SolicitudOut>(`/solicitudes/${usuarioId}`, { method: 'POST', body });
}

/** Fetch a single solicitud by id. */
export function getSolicitud(solicitudId: number): Promise<SolicitudOut> {
  return apiFetch<SolicitudOut>(`/solicitudes/${solicitudId}`);
}

/** List solicitudes, optionally filtered by estado (passed as a query param). */
export function listSolicitudes(opts?: { estado?: EstadoSolicitud }): Promise<SolicitudOut[]> {
  return apiFetch<SolicitudOut[]>('/solicitudes', { query: { estado: opts?.estado } });
}

/** Resolve a solicitud (accept/reject/etc.) with admin resolution data. */
export function resolverSolicitud(
  solicitudId: number,
  body: SolicitudResolucion,
): Promise<SolicitudOut> {
  return apiFetch<SolicitudOut>(`/solicitudes/${solicitudId}/resolver`, { method: 'POST', body });
}

/** User accepts/rejects the proposed base price and commissions. */
export function responderSolicitud(solicitudId: number, acepta: boolean): Promise<SolicitudOut> {
  return apiFetch<SolicitudOut>(`/solicitudes/${solicitudId}/responder`, {
    method: 'POST',
    body: { acepta },
  });
}
