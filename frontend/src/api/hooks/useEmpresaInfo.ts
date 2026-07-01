import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/api/client';

type DepositoInspeccion = {
  nombre: string;
  direccion: string;
  ciudad: string;
};

type HealthResponse = {
  status: string;
  app: string;
  deposito_inspeccion: DepositoInspeccion;
};

async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

/** Datos del depósito de inspección donde el vendedor debe enviar su bien. */
export function useDepositoInspeccion() {
  return useQuery<DepositoInspeccion | null>({
    queryKey: ['empresa', 'deposito_inspeccion'],
    queryFn: async () => {
      const data = await fetchHealth();
      return data.deposito_inspeccion ?? null;
    },
    staleTime: 1000 * 60 * 10, // 10 min — el depósito no cambia frecuentemente
  });
}
