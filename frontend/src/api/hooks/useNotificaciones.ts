/**
 * React Query hooks for notificaciones (private messages).
 *
 * Screens pass the usuarioId explicitly; these hooks never read session state.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as notificacionesApi from '@/api/endpoints/notificaciones';
import { queryClient, queryKeys } from '@/api/query-client';
import type { NotificacionOut } from '@/api/types';

function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/** A user's notifications, newest first. Disabled until `usuarioId` is valid. */
export function useNotificaciones(usuarioId: number | null) {
  return useQuery<NotificacionOut[]>({
    queryKey: queryKeys.notificaciones(usuarioId ?? 0),
    queryFn: () => notificacionesApi.listNotificaciones(usuarioId as number),
    enabled: isValidId(usuarioId),
  });
}

/** Mark a notification as read; refreshes the user's list. */
export function useMarcarLeida(usuarioId: number) {
  return useMutation<NotificacionOut, Error, number>({
    mutationFn: (id: number) => notificacionesApi.marcarLeida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones(usuarioId) });
    },
  });
}

/** Delete all notifications for a user; clears the list on success. */
export function useEliminarNotificaciones(usuarioId: number) {
  return useMutation<void, Error, void>({
    mutationFn: () => notificacionesApi.eliminarTodasNotificaciones(usuarioId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.notificaciones(usuarioId), []);
    },
  });
}
