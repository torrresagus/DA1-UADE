/**
 * Notificaciones endpoints (Sistema de Subastas API).
 *
 *   GET  /usuarios/{id}/notificaciones      -> NotificacionOut[]
 *   POST /notificaciones/{id}/leer          -> NotificacionOut
 */

import { apiFetch } from '@/api/client';
import type { NotificacionOut } from '@/api/types';

/** Private messages for a user, newest first. */
export function listNotificaciones(usuarioId: number): Promise<NotificacionOut[]> {
  return apiFetch<NotificacionOut[]>(`/usuarios/${usuarioId}/notificaciones`);
}

/** Mark a notification as read. */
export function marcarLeida(notificacionId: number): Promise<NotificacionOut> {
  return apiFetch<NotificacionOut>(`/notificaciones/${notificacionId}/leer`, { method: 'POST' });
}

/** Delete all notifications for a user. */
export function eliminarTodasNotificaciones(usuarioId: number): Promise<void> {
  return apiFetch<void>(`/usuarios/${usuarioId}/notificaciones`, { method: 'DELETE' });
}
