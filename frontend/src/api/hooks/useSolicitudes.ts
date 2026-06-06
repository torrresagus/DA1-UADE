/**
 * React Query hooks for solicitudes (consignment requests).
 *
 * Ids are passed in as arguments by the calling screen (e.g. session.usuarioId);
 * these hooks never read AsyncStorage or session state directly.
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import * as solicitudesApi from '@/api/endpoints/solicitudes';
import { queryClient, queryKeys } from '@/api/query-client';
import type { SolicitudCreate, SolicitudOut } from '@/api/types';

/** True for ids that are usable as backend resource identifiers. */
function isValidId(id: number | null | undefined): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/**
 * Create a consignment request for the given user.
 *
 * The mutation resolves to the created {@link SolicitudOut}; callers typically
 * navigate to product-status using `data.id`. Invalidates the solicitudes list
 * on success so `useMisSolicitudes` refetches.
 */
export function useCrearSolicitud(usuarioId: number) {
  return useMutation<SolicitudOut, Error, SolicitudCreate>({
    mutationFn: (body: SolicitudCreate) => solicitudesApi.crearSolicitud(usuarioId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.solicitudes() });
    },
  });
}

/** Fetch a single solicitud by id. Disabled until `solicitudId` is valid. */
export function useSolicitud(solicitudId: number | null) {
  return useQuery({
    queryKey: queryKeys.solicitud(solicitudId as number),
    queryFn: () => solicitudesApi.getSolicitud(solicitudId as number),
    enabled: isValidId(solicitudId),
  });
}

/**
 * List the current user's solicitudes.
 *
 * The list endpoint is not user-scoped, so we fetch all solicitudes and filter
 * client-side by `usuario_id`. Disabled until `usuarioId` is valid.
 */
export function useMisSolicitudes(usuarioId: number | null) {
  return useQuery<SolicitudOut[]>({
    queryKey: queryKeys.solicitudes(),
    queryFn: async () => {
      const all = await solicitudesApi.listSolicitudes();
      return all.filter((s) => s.usuario_id === usuarioId);
    },
    enabled: isValidId(usuarioId),
  });
}
