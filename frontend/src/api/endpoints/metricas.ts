/**
 * Métricas endpoints (Sistema de Subastas API).
 *
 *   GET /metricas/usuario/{id}  -> MetricasUsuario
 *   GET /metricas/subasta/{id}  -> MetricasSubasta
 */

import { apiFetch } from '@/api/client';
import type { MetricasUsuario, MetricasSubasta } from '@/api/types';

/** Aggregated activity metrics for a single user. */
export function getMetricasUsuario(usuarioId: number): Promise<MetricasUsuario> {
  return apiFetch<MetricasUsuario>(`/metricas/usuario/${usuarioId}`);
}

/** Aggregated metrics for a single auction (items, sales, revenue, bids). */
export function getMetricasSubasta(subastaId: number): Promise<MetricasSubasta> {
  return apiFetch<MetricasSubasta>(`/metricas/subasta/${subastaId}`);
}
