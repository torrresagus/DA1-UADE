/**
 * TypeScript mirrors of the FastAPI backend schemas (Sistema de Subastas API).
 *
 * Source of truth: repo `app/` + `Swagger.json`. Money/Decimal fields are
 * serialized by the backend as STRINGS (e.g. "10000.00", "10200.0000"); metric
 * aggregates come as floats. We type them faithfully and convert with `num()`.
 */

// ─── Enums (string unions + ordered constants) ──────────────────────────────

export type CategoriaUsuario = 'comun' | 'especial' | 'plata' | 'oro' | 'platino';

/** Rank used to gate access by `subasta.categoria_minima`. Higher = more access. */
export const CATEGORIA_RANK: Record<CategoriaUsuario, number> = {
  comun: 1,
  especial: 2,
  plata: 3,
  oro: 4,
  platino: 5,
};

export type EstadoRegistro =
  | 'pendiente_verificacion'
  | 'aprobado_fase_1'
  | 'completo'
  | 'rechazado'
  | 'bloqueado';

export type EstadoSubasta = 'programada' | 'abierta' | 'cerrada' | 'cancelada';
export type EstadoSolicitud =
  | 'ingresada'
  | 'en_inspeccion'
  | 'aceptada'
  | 'rechazada'
  | 'confirmada_por_usuario'
  | 'rechazada_por_usuario'
  | 'devuelta';
export type EstadoArticulo = 'disponible' | 'en_subasta' | 'vendido' | 'retirado';
export type EstadoPuja = 'pendiente' | 'confirmada' | 'rechazada';
export type Moneda = 'ARS' | 'USD';
export type TipoMedioPago = 'cuenta_bancaria' | 'tarjeta_credito' | 'cheque_certificado';
export type EstadoMedioPago = 'pendiente' | 'verificado' | 'rechazado';

/** Decimal money as delivered by the API (string) — convert with `num()` before math/format. */
export type Money = string | number;

/** Coerce an API money value (string Decimal or float) to a JS number. */
export function num(value: Money | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Usuarios / auth ────────────────────────────────────────────────────────

export interface UsuarioOut {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  domicilio: string;
  pais: string;
  categoria: CategoriaUsuario;
  estado_registro: EstadoRegistro;
  bloqueado_por_impago: boolean;
  fecha_alta: string;
}

export interface UsuarioRegistroEtapa1 {
  nombre: string;
  apellido: string;
  email: string;
  domicilio: string;
  pais: string;
  doc_frente_url?: string | null;
  doc_dorso_url?: string | null;
}

export interface UsuarioRegistroEtapa2 {
  password: string;
}

export interface UsuarioAprobacion {
  categoria: CategoriaUsuario;
}

export interface CuentaCobroCreate {
  banco: string;
  pais: string;
  numero_cuenta: string;
  titular: string;
  declarada_antes_subasta?: boolean;
}

export interface CuentaCobroOut {
  id: number;
  usuario_id: number;
  banco: string;
  pais: string;
  numero_cuenta: string;
  titular: string;
  declarada_antes_subasta: boolean;
}

// ─── Medios de pago ─────────────────────────────────────────────────────────

export interface MedioPagoCreate {
  tipo: TipoMedioPago;
  titular: string;
  detalle: string;
  pais: string;
  monto_garantia?: Money | null;
  moneda?: Moneda | null;
}

export interface MedioPagoOut {
  id: number;
  usuario_id: number;
  tipo: TipoMedioPago;
  titular: string;
  detalle: string;
  pais: string;
  monto_garantia: Money | null;
  moneda: Moneda | null;
  estado: EstadoMedioPago;
  verificado: boolean;
}

export interface MedioPagoVerificar {
  verificado: boolean;
}

// ─── Artículos + imágenes ───────────────────────────────────────────────────

export interface ImagenArticuloCreate {
  url: string;
  orden?: number;
}

export interface ImagenArticuloOut {
  id: number;
  url: string;
  orden: number;
}

export interface ArticuloCreate {
  numero_pieza: string;
  descripcion: string;
  precio_base: Money;
  moneda?: Moneda;
  dueno_actual_id?: number | null;
  artista?: string | null;
  fecha_obra?: string | null;
  historia?: string | null;
  cantidad_elementos?: number;
  imagenes?: ImagenArticuloCreate[];
}

export interface ArticuloOut {
  id: number;
  numero_pieza: string;
  descripcion: string;
  precio_base: Money;
  moneda: Moneda;
  dueno_actual_id: number | null;
  artista: string | null;
  fecha_obra: string | null;
  historia: string | null;
  cantidad_elementos: number;
  estado: EstadoArticulo;
  deposito_id: number | null;
  imagenes: ImagenArticuloOut[];
}

export interface DepositoCreate {
  nombre: string;
  direccion: string;
  ciudad: string;
}
export interface DepositoOut extends DepositoCreate {
  id: number;
}

export interface SeguroCreate {
  nro_poliza: string;
  compania: string;
  beneficiario_id: number;
  monto_cubierto: Money;
  moneda?: Moneda;
  articulo_ids?: number[];
}
export interface SeguroOut {
  id: number;
  nro_poliza: string;
  compania: string;
  beneficiario_id: number;
  monto_cubierto: Money;
  moneda: Moneda;
  vigente?: boolean;
  articulo_ids?: number[];
}

// ─── Subastas + catálogo ────────────────────────────────────────────────────

export interface CatalogoItemCreate {
  articulo_id: number;
  precio_base: Money;
  orden?: number;
}

export interface CatalogoItemOut {
  id: number;
  subasta_id: number;
  articulo_id: number;
  precio_base: Money;
  orden: number;
  vendido: boolean;
}

export interface CatalogoPublicoItem {
  id: number;
  articulo_id: number;
  orden: number;
  vendido: boolean;
}

export interface SubastaCreate {
  nombre: string;
  fecha_hora: string;
  ubicacion: string;
  categoria_minima: CategoriaUsuario;
  moneda?: Moneda;
  rematador_id: number;
  es_coleccion?: boolean;
  nombre_coleccion?: string | null;
}

export interface SubastaOut {
  id: number;
  nombre: string;
  fecha_hora: string;
  ubicacion: string;
  categoria_minima: CategoriaUsuario;
  moneda: Moneda;
  estado: EstadoSubasta;
  rematador_id: number;
  es_coleccion: boolean;
  nombre_coleccion: string | null;
  catalogo: CatalogoItemOut[];
}

export interface SubastaPublicaOut {
  id: number;
  nombre: string;
  fecha_hora: string;
  ubicacion: string;
  categoria_minima: CategoriaUsuario;
  moneda: Moneda;
  estado: EstadoSubasta;
  catalogo: CatalogoPublicoItem[];
}

export interface SubastaCambioEstado {
  estado: EstadoSubasta;
}

// ─── Pujas ──────────────────────────────────────────────────────────────────

export interface PujaCreate {
  catalogo_item_id: number;
  usuario_id: number;
  monto: number;
}

export interface PujaOut {
  id: number;
  subasta_id: number;
  catalogo_item_id: number;
  usuario_id: number;
  monto: Money;
  fecha_hora: string;
  estado: EstadoPuja;
}

export interface MejorOferta {
  catalogo_item_id: number;
  mejor_monto: Money | null;
  usuario_id: number | null;
  minimo_proxima: Money;
  maximo_proxima: Money | null;
}

// ─── Ventas + multas ────────────────────────────────────────────────────────

export interface VentaOut {
  id: number;
  catalogo_item_id: number;
  comprador_id: number;
  medio_pago_id: number | null;
  monto_final: Money;
  comision: Money;
  costo_envio: Money;
  retira_personalmente: boolean;
  moneda: Moneda;
  fecha: string;
  pagada: boolean;
}

export interface MultaCreate {
  usuario_id: number;
  venta_id: number;
  monto: Money;
  moneda?: Moneda;
  motivo: string;
}

export interface MultaOut {
  id: number;
  usuario_id: number;
  venta_id: number | null;
  monto: Money;
  moneda: Moneda;
  motivo: string;
  pagada: boolean;
  fecha: string;
  fecha_vencimiento?: string | null;
  derivada_justicia?: boolean;
}

// ─── Solicitudes ────────────────────────────────────────────────────────────

export interface ImagenSolicitudCreate {
  url: string;
  orden?: number;
}
export interface ImagenSolicitudOut {
  id: number;
  url: string;
  orden: number;
}

export interface SolicitudCreate {
  descripcion: string;
  datos_historicos?: string | null;
  declara_propiedad: boolean;
  origen_licito_acreditado: boolean;
  acepta_devolucion_con_cargo: boolean;
  imagenes?: ImagenSolicitudCreate[];
}

export interface SolicitudOut {
  id: number;
  usuario_id: number;
  descripcion: string;
  datos_historicos: string | null;
  declara_propiedad: boolean;
  origen_licito_acreditado: boolean;
  revisar_origen?: boolean;
  acepta_devolucion_con_cargo: boolean;
  estado: EstadoSolicitud;
  motivo_rechazo: string | null;
  precio_base_propuesto: Money | null;
  comision_propuesta: Money | null;
  fecha_subasta_propuesta: string | null;
  respuesta_usuario?: boolean | null;
  fecha: string;
  imagenes: ImagenSolicitudOut[];
}

export interface SolicitudResolucion {
  estado: EstadoSolicitud;
  motivo_rechazo?: string | null;
  precio_base_propuesto?: Money | null;
  comision_propuesta?: Money | null;
  fecha_subasta_propuesta?: string | null;
}

// ─── Rematadores ────────────────────────────────────────────────────────────

export interface RematadorCreate {
  nombre: string;
  apellido: string;
  matricula: string;
}
export interface RematadorOut extends RematadorCreate {
  id: number;
}

// ─── Notificaciones ─────────────────────────────────────────────────────────

export interface NotificacionOut {
  id: number;
  usuario_id: number;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  fecha: string;
}

// ─── Métricas (inline dict shapes — not in OpenAPI components) ───────────────

export interface MetricaPorCategoria {
  categoria: string;
  cantidad_pujas: number;
  importe_ofertado: number;
  subastas_ganadas: number;
  importe_pagado: number;
}

export interface MetricasUsuario {
  usuario_id: number;
  subastas_asistidas: number;
  cantidad_pujas: number;
  subastas_ganadas: number;
  importe_ofertado: number;
  importe_pagado: number;
  por_categoria?: MetricaPorCategoria[];
}

export interface MetricasSubasta {
  subasta_id: number;
  cantidad_items?: number;
  items_vendidos?: number;
  recaudacion_total?: number;
  cantidad_pujas?: number;
  [key: string]: number | undefined;
}
