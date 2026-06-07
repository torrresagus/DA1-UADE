/**
 * Image picking + upload to the backend's local storage (`POST /uploads`).
 *
 * The backend saves the file under ./media and serves it at /media/<name>,
 * returning an absolute URL we store in doc_frente_url / image lists.
 *
 * Note: we use raw `fetch` (not apiFetch) because multipart uploads must NOT set
 * a JSON Content-Type — fetch sets the multipart boundary itself.
 */

import * as ImagePicker from 'expo-image-picker';

import { API_BASE_URL, ApiError } from '@/api/client';

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

/** Upload a local file URI to the backend; resolves to its public URL. */
export async function uploadImageAsync(uri: string): Promise<string> {
  const name = uri.split('/').pop() || `photo-${uri.length}.jpg`;
  const form = new FormData();
  // React Native's FormData accepts this {uri,name,type} shape for files.
  form.append('file', { uri, name, type: guessType(name) } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_BASE_URL}).`, 'network');
  }
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, parsed?.detail ?? `Error ${res.status}`);
  }
  return parsed.url as string;
}

/**
 * Ask for permission, open the library picker, and upload the chosen image.
 * Resolves to the uploaded URL, or `null` if the user cancelled.
 * Throws (ApiError / Error) on permission denial or upload failure.
 */
export async function pickAndUploadAsync(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;
  return uploadImageAsync(result.assets[0].uri);
}
