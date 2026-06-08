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
import { Platform } from 'react-native';

import { API_BASE_URL, ApiError } from '@/api/client';

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'];

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function extFromType(type: string): string {
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  if (type.includes('heic')) return '.heic';
  return '.jpg';
}

/** Backend rejects unknown extensions; ensure the filename has a valid one. */
function ensureName(name: string, type: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXT.includes(ext)) return name;
  return `${name || 'photo'}${extFromType(type)}`;
}

/** Upload a local file URI to the backend; resolves to its public URL. */
export async function uploadImageAsync(uri: string): Promise<string> {
  const rawName = uri.split('/').pop() || `photo-${uri.length}`;
  const form = new FormData();

  if (Platform.OS === 'web') {
    // On web the picker returns a blob:/data: URL. The RN {uri,name,type} shape
    // is NOT a real file here (it serializes as text -> backend 422), so we
    // fetch the URI into an actual Blob and append that.
    const blob = await (await fetch(uri)).blob();
    const type = blob.type || guessType(rawName);
    form.append('file', blob, ensureName(rawName, type));
  } else {
    // React Native's FormData accepts this {uri,name,type} shape for files.
    const type = guessType(rawName);
    form.append('file', { uri, name: ensureName(rawName, type), type } as unknown as Blob);
  }

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
