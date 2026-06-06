/**
 * Usuarios endpoints — registration flow, approval, payment methods and
 * collection accounts. No auth: the integer `usuario_id` is the identity.
 *
 * Thin wrappers over `apiFetch`/`del`; see VERIFIED BACKEND PATHS in the API
 * docs. `findUsuarioByEmail` is a client-side helper used by login.
 */

import { apiFetch, del } from '@/api/client';
import type {
  UsuarioOut,
  UsuarioRegistroEtapa1,
  UsuarioRegistroEtapa2,
  UsuarioAprobacion,
  CuentaCobroCreate,
  CuentaCobroOut,
  MedioPagoCreate,
  MedioPagoOut,
  MedioPagoVerificar,
} from '@/api/types';

// ─── Usuarios ────────────────────────────────────────────────────────────────

export async function listUsuarios(signal?: AbortSignal): Promise<UsuarioOut[]> {
  return apiFetch<UsuarioOut[]>('/usuarios', { signal });
}

export async function getUsuario(id: number): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>(`/usuarios/${id}`);
}

export async function registroEtapa1(body: UsuarioRegistroEtapa1): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>('/usuarios/registro/etapa-1', { method: 'POST', body });
}

export async function aprobacion(id: number, body: UsuarioAprobacion): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>(`/usuarios/${id}/aprobacion`, { method: 'POST', body });
}

export async function registroEtapa2(id: number, body: UsuarioRegistroEtapa2): Promise<UsuarioOut> {
  return apiFetch<UsuarioOut>(`/usuarios/${id}/registro/etapa-2`, { method: 'POST', body });
}

// ─── Medios de pago ──────────────────────────────────────────────────────────

export async function listMediosPago(usuarioId: number): Promise<MedioPagoOut[]> {
  return apiFetch<MedioPagoOut[]>(`/usuarios/${usuarioId}/medios-pago`);
}

export async function createMedioPago(
  usuarioId: number,
  body: MedioPagoCreate,
): Promise<MedioPagoOut> {
  return apiFetch<MedioPagoOut>(`/usuarios/${usuarioId}/medios-pago`, { method: 'POST', body });
}

export async function verificarMedioPago(
  usuarioId: number,
  mpId: number,
  body: MedioPagoVerificar,
): Promise<MedioPagoOut> {
  return apiFetch<MedioPagoOut>(`/usuarios/${usuarioId}/medios-pago/${mpId}/verificar`, {
    method: 'POST',
    body,
  });
}

export async function deleteMedioPago(usuarioId: number, mpId: number): Promise<void> {
  return del(`/usuarios/${usuarioId}/medios-pago/${mpId}`);
}

// ─── Cuentas de cobro ────────────────────────────────────────────────────────

export async function listCuentasCobro(usuarioId: number): Promise<CuentaCobroOut[]> {
  return apiFetch<CuentaCobroOut[]>(`/usuarios/${usuarioId}/cuentas-cobro`);
}

export async function createCuentaCobro(
  usuarioId: number,
  body: CuentaCobroCreate,
): Promise<CuentaCobroOut> {
  return apiFetch<CuentaCobroOut>(`/usuarios/${usuarioId}/cuentas-cobro`, { method: 'POST', body });
}

// ─── Login helper ────────────────────────────────────────────────────────────

/**
 * Find a usuario by email (case-insensitive, trimmed). Used by login since the
 * backend has no auth endpoint — we list and match client-side.
 */
export async function findUsuarioByEmail(email: string): Promise<UsuarioOut | null> {
  const target = email.trim().toLowerCase();
  const usuarios = await listUsuarios();
  return usuarios.find((u) => u.email.trim().toLowerCase() === target) ?? null;
}
