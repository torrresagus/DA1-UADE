import { QueryClient } from '@tanstack/react-query';

/** Singleton QueryClient tuned for React Native (no window focus, modest retry). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Centralized query keys so hooks and invalidations stay in sync. */
export const queryKeys = {
  usuarios: () => ['usuarios'] as const,
  usuario: (id: number) => ['usuario', id] as const,
  mediosPago: (usuarioId: number) => ['medios-pago', usuarioId] as const,
  cuentasCobro: (usuarioId: number) => ['cuentas-cobro', usuarioId] as const,
  subastas: (estado?: string) => ['subastas', estado ?? 'all'] as const,
  subastasPublicas: () => ['subastas', 'publicas'] as const,
  subasta: (id: number) => ['subasta', id] as const,
  articulos: () => ['articulos'] as const,
  articulo: (id: number) => ['articulo', id] as const,
  lots: (filter?: string) => ['lots', filter ?? 'all'] as const,
  lot: (catalogoItemId: number) => ['lot', catalogoItemId] as const,
  mejor: (catalogoItemId: number) => ['mejor', catalogoItemId] as const,
  pujasItem: (catalogoItemId: number) => ['pujas-item', catalogoItemId] as const,
  pujasUsuario: (usuarioId: number) => ['pujas-usuario', usuarioId] as const,
  ventas: () => ['ventas'] as const,
  multas: (usuarioId: number) => ['multas', usuarioId] as const,
  solicitudes: () => ['solicitudes'] as const,
  solicitud: (id: number) => ['solicitud', id] as const,
  metricasUsuario: (usuarioId: number) => ['metricas-usuario', usuarioId] as const,
  metricasSubasta: (subastaId: number) => ['metricas-subasta', subastaId] as const,
  seguros: (beneficiarioId: number) => ['seguros', beneficiarioId] as const,
  deposito: (id: number) => ['deposito', id] as const,
  notificaciones: (usuarioId: number) => ['notificaciones', usuarioId] as const,
};
