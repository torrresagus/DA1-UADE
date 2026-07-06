/**
 * Pure mappers from backend shapes to the UI view-models.
 *
 * Centralizes the lot-centric flattening the Home design needs: a card = one
 * CatalogoItem joined with its Articulo (for title/image) and its MejorOferta
 * (for the current bid). Images live ONLY on Articulo, so callers must provide
 * an article index (fetch GET /articulos once and index by id).
 */

import type { Auction } from '@/components/auction-card';

import { resolveImageUrl } from '@/api/client';
import {
  ArticuloOut,
  CatalogoItemOut,
  CategoriaUsuario,
  CATEGORIA_RANK,
  EstadoSubasta,
  MejorOferta,
  Moneda,
  num,
  SubastaOut,
} from '@/api/types';
import { parseUtcDate } from '@/utils/format';

export type LotStatus = 'live' | 'upcoming' | 'closed';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Relojes: ['reloj', 'watch', 'rolex', 'omega', 'cartier', 'seiko', 'breitling', 'tag heuer', 'cronógrafo'],
  Autos: ['auto', 'coche', 'carro', 'vehículo', 'ferrari', 'porsche', 'bmw', 'mercedes', 'ford', 'chevrolet', 'lamborghini', 'maserati', 'bugatti'],
  Joyas: ['joya', 'diamante', 'oro', 'plata', 'anillo', 'collar', 'pulsera', 'esmeralda', 'rubí', 'zafiro', 'perla', 'brillante', 'gema'],
  Arte: ['arte', 'pintura', 'cuadro', 'escultura', 'dibujo', 'grabado', 'óleo', 'acuarela', 'lienzo', 'picasso', 'dalí', 'obra'],
  Vinos: ['vino', 'wine', 'malbec', 'cabernet', 'champagne', 'champán', 'whisky', 'cognac', 'bodega', 'añada', 'espumante'],
  Coleccionables: ['colección', 'figura', 'moneda', 'sello', 'estampilla', 'vintage', 'antigüedad', 'coleccionable', 'rareza', 'edición limitada'],
};

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'Otros';
}

export function estadoToStatus(estado: EstadoSubasta): LotStatus {
  if (estado === 'abierta') return 'live';
  if (estado === 'programada') return 'upcoming';
  return 'closed';
}

export function statusLabel(status: LotStatus): string {
  return status === 'live' ? 'En vivo' : status === 'upcoming' ? 'Próxima' : 'Cerrada';
}

/** A bidder lacks access when their tier rank is below the auction's minimum. */
export function computeLocked(
  usuarioCategoria: CategoriaUsuario | null | undefined,
  categoriaMinima: CategoriaUsuario,
): boolean {
  const userRank = usuarioCategoria ? CATEGORIA_RANK[usuarioCategoria] : 0;
  return userRank < CATEGORIA_RANK[categoriaMinima];
}

function formatDate(iso: string): string {
  const d = parseUtcDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Timing label for the card: start date for upcoming auctions; none for live (no end time on the backend). */
export function timingLabel(estado: EstadoSubasta, fechaHora: string): string | undefined {
  const status = estadoToStatus(estado);
  if (status === 'upcoming') return `Empieza ${formatDate(fechaHora)}`;
  if (status === 'closed') return 'Finalizada';
  return undefined;
}

export type ArticulosIndex = Record<number, ArticuloOut>;
export type MejorIndex = Record<number, MejorOferta>;

function firstImage(articulo: ArticuloOut | undefined): string {
  const raw = articulo?.imagenes?.[0]?.url;
  return raw ? resolveImageUrl(raw) : 'https://placehold.co/600x400?text=Sin+imagen';
}

/**
 * Strips the upload-form noise from articulo.descripcion:
 *   "Título — Descripción real (precio sugerido: 100.000 ARS)" → "Descripción real"
 */
function cleanTitle(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let s = raw;
  // Remove leading "Title — " prefix (em-dash or regular hyphen)
  const emDash = s.indexOf(' — ');
  const hyphen = s.indexOf(' - ');
  if (emDash >= 0) s = s.slice(emDash + 3);
  else if (hyphen >= 0) s = s.slice(hyphen + 3);
  // Remove trailing " (precio sugerido: ...)" suffix
  s = s.replace(/\s*\(precio sugerido:[^)]*\)/i, '').trim();
  return s || undefined;
}

/** Map a single catalogo item to the Auction card VM. */
export function toLotCard(
  subasta: SubastaOut,
  item: CatalogoItemOut,
  articulosById: ArticulosIndex,
  mejorByItemId: MejorIndex,
  usuarioCategoria: CategoriaUsuario | null | undefined,
): Auction {
  const articulo = articulosById[item.articulo_id];
  const status = estadoToStatus(subasta.estado);
  const mejor = mejorByItemId[item.id];
  // precio_base es null para invitados (no registrados): el precio queda oculto.
  const currentBid =
    mejor?.mejor_monto != null
      ? num(mejor.mejor_monto)
      : item.precio_base != null
        ? num(item.precio_base)
        : null;

  const searchText = [articulo?.descripcion ?? '', articulo?.artista ?? '', subasta.nombre ?? ''].join(' ');

  return {
    id: String(item.id),
    title: cleanTitle(articulo?.descripcion) ?? articulo?.numero_pieza ?? `Lote #${item.id}`,
    image: firstImage(articulo),
    currentBid,
    bidLabel: mejor?.mejor_monto != null ? 'Puja actual' : 'Precio base',
    moneda: subasta.moneda,
    category: inferCategory(searchText),
    status: item.vendido ? 'closed' : status,
    statusLabel: item.vendido ? 'Vendido' : statusLabel(status),
    endsInLabel: timingLabel(subasta.estado, subasta.fecha_hora),
    locked: computeLocked(usuarioCategoria, subasta.categoria_minima),
    esColeccion: subasta.es_coleccion,
    nombreColeccion: subasta.nombre_coleccion,
    categoriaMinima: subasta.categoria_minima,
  };
}

/** Flatten every auction's catalogo into a flat list of lot cards (Home). */
export function toLotCards(
  subastas: SubastaOut[],
  articulosById: ArticulosIndex,
  mejorByItemId: MejorIndex,
  usuarioCategoria: CategoriaUsuario | null | undefined,
): Auction[] {
  const cards: Auction[] = [];
  for (const subasta of subastas) {
    for (const item of subasta.catalogo ?? []) {
      cards.push(toLotCard(subasta, item, articulosById, mejorByItemId, usuarioCategoria));
    }
  }
  return cards.sort((a, b) => {
    const order = { live: 0, upcoming: 1, closed: 2 } as const;
    return order[a.status] - order[b.status];
  });
}

// ─── Detail / live view-models ──────────────────────────────────────────────

export type AuctionDetailVM = {
  catalogoItemId: number;
  subastaId: number;
  articuloId: number;
  title: string;
  numeroPieza: string;
  images: string[];
  description: string;
  artista: string | null;
  fechaObra: string | null;
  historia: string | null;
  cantidadElementos: number;
  /** null cuando el usuario no está registrado (precio base oculto). */
  basePrice: number | null;
  currentBid: number | null;
  moneda: Moneda;
  status: LotStatus;
  statusLabel: string;
  timingLabel?: string;
  closingTime: string | null;
  ubicacion: string;
  subastaNombre: string;
  categoriaMinima: CategoriaUsuario;
  locked: boolean;
  vendido: boolean;
  esColeccion: boolean;
  nombreColeccion: string | null;
};

export function toAuctionDetailVM(
  subasta: SubastaOut,
  item: CatalogoItemOut,
  articulo: ArticuloOut | undefined,
  mejor: MejorOferta | undefined,
  usuarioCategoria: CategoriaUsuario | null | undefined,
): AuctionDetailVM {
  const status = estadoToStatus(subasta.estado);
  const images = (articulo?.imagenes ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((i) => resolveImageUrl(i.url));
  return {
    catalogoItemId: item.id,
    subastaId: subasta.id,
    articuloId: item.articulo_id,
    title: cleanTitle(articulo?.descripcion) ?? articulo?.numero_pieza ?? `Lote #${item.id}`,
    numeroPieza: articulo?.numero_pieza ?? '',
    images: images.length ? images : [firstImage(articulo)],
    description: articulo?.historia ?? articulo?.descripcion ?? '',
    artista: articulo?.artista ?? null,
    fechaObra: articulo?.fecha_obra ?? null,
    historia: articulo?.historia ?? null,
    cantidadElementos: articulo?.cantidad_elementos ?? 1,
    basePrice: item.precio_base != null ? num(item.precio_base) : null,
    currentBid:
      mejor?.mejor_monto != null
        ? num(mejor.mejor_monto)
        : item.precio_base != null
          ? num(item.precio_base)
          : null,
    moneda: subasta.moneda,
    status,
    statusLabel: item.vendido ? 'Vendido' : statusLabel(status),
    timingLabel: timingLabel(subasta.estado, subasta.fecha_hora),
    closingTime: subasta.estado === 'abierta' && subasta.fecha_hora
      ? (subasta.fecha_hora.endsWith('Z') ? subasta.fecha_hora : subasta.fecha_hora + 'Z')
      : null,
    ubicacion: subasta.ubicacion,
    subastaNombre: subasta.nombre,
    categoriaMinima: subasta.categoria_minima,
    locked: computeLocked(usuarioCategoria, subasta.categoria_minima),
    vendido: item.vendido,
    esColeccion: subasta.es_coleccion,
    nombreColeccion: subasta.nombre_coleccion,
  };
}

/** Client-side bid summary. Commission is only truly computed at sale close; this is an estimate. */
export const COMMISSION_RATE = 0.1;

export function commissionPreview(monto: number, rate: number = COMMISSION_RATE) {
  const comision = Math.round(monto * rate * 100) / 100;
  return { puja: monto, comision, total: monto + comision };
}

/** Human label for a bidder in the live history list. */
export function bidderLabel(pujaUsuarioId: number, selfUsuarioId: number | null): string {
  if (selfUsuarioId != null && pujaUsuarioId === selfUsuarioId) return 'Vos';
  return `Usuario #${pujaUsuarioId}`;
}
