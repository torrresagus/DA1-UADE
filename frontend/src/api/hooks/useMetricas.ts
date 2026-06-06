/**
 * React Query hooks for user metrics (Bidify Expo app).
 *
 * Hooks receive ids as arguments — the screen passes `session.usuarioId`.
 * No AsyncStorage / session access here.
 */

import { useQuery } from '@tanstack/react-query';

import * as usuariosApi from '@/api/endpoints/usuarios';
import * as metricasApi from '@/api/endpoints/metricas';
import { queryKeys } from '@/api/query-client';
import type { UsuarioOut, MetricasUsuario } from '@/api/types';

/** True when `id` is a usable positive backend identifier. */
function isValidId(id: number | null): id is number {
  return id != null && Number.isFinite(id) && id > 0;
}

/**
 * Aggregated activity metrics for a single user.
 * Disabled until `usuarioId` is a valid positive id.
 */
export function useMetricasUsuario(usuarioId: number | null) {
  const enabled = isValidId(usuarioId);
  return useQuery({
    queryKey: queryKeys.metricasUsuario(usuarioId ?? 0),
    queryFn: () => metricasApi.getMetricasUsuario(usuarioId as number),
    enabled,
  });
}

/** Combined user profile: the usuario record plus its activity metrics. */
export interface Profile {
  usuario: UsuarioOut;
  metricas: MetricasUsuario;
}

/**
 * Fetches the usuario record and its metrics in parallel and returns them as a
 * single `{ usuario, metricas }` object. Disabled until `usuarioId` is valid.
 */
export function useProfile(usuarioId: number | null) {
  const enabled = isValidId(usuarioId);
  return useQuery<Profile>({
    queryKey: ['profile', usuarioId ?? 0],
    queryFn: async () => {
      const id = usuarioId as number;
      const [usuario, metricas] = await Promise.all([
        usuariosApi.getUsuario(id),
        metricasApi.getMetricasUsuario(id),
      ]);
      return { usuario, metricas };
    },
    enabled,
  });
}
