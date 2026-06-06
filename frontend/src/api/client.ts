/**
 * Typed fetch wrapper around the Sistema de Subastas FastAPI backend.
 *
 * Base URL resolution (Expo inlines EXPO_PUBLIC_* at build time):
 *   1. EXPO_PUBLIC_API_URL if set.
 *   2. Platform default — web/iOS sim use localhost; Android emulator uses
 *      10.0.2.2 (host loopback alias); a physical device falls back to the
 *      Expo dev host LAN IP (Constants.expoConfig.hostUri) so most LAN setups
 *      work without manual config.
 *
 * There is NO server auth: the integer `usuario_id` is the identity and is
 * passed as a path param on nested calls (see SessionContext).
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 8000;

function deviceHostFallback(): string {
  // e.g. hostUri "192.168.1.42:8081" -> "http://192.168.1.42:8000"
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.hostUri;
  if (hostUri) {
    const host = String(hostUri).split(':')[0];
    if (host && host !== 'localhost') return `http://${host}:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_PORT}`;
  if (Platform.OS === 'web' || Platform.OS === 'ios') return `http://localhost:${DEFAULT_PORT}`;
  return deviceHostFallback();
}

export const API_BASE_URL = resolveBaseUrl();

/** Error that preserves the backend's `detail` string (400 puja messages, 404/409, etc.). */
export class ApiError extends Error {
  status: number;
  detail: string;
  code?: string;

  constructor(status: number, detail: string, code?: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

function extractDetail(body: unknown, status: number): { detail: string; code?: string } {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    // FastAPI 422 -> detail is an array of validation errors.
    if (Array.isArray(b.detail)) {
      const msg = b.detail
        .map((e) => (e && typeof e === 'object' ? (e as any).msg : String(e)))
        .filter(Boolean)
        .join('; ');
      return { detail: msg || 'Datos inválidos' };
    }
    if (typeof b.detail === 'string') return { detail: b.detail, code: b.code as string };
    if (typeof b.message === 'string') return { detail: b.message, code: b.code as string };
  }
  return { detail: `Error ${status}` };
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_BASE_URL}).`, 'network');
  }

  if (res.status === 204) return undefined as T;

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const { detail, code } = extractDetail(parsed, res.status);
    throw new ApiError(res.status, detail, code);
  }

  return parsed as T;
}

/** DELETE helper that tolerates empty (204) bodies. */
export function del(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<void> {
  return apiFetch<void>(path, { ...options, method: 'DELETE' });
}
