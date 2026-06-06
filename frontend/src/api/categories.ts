/**
 * Product-interest categories and Home filters.
 *
 * NOTE: the backend has NO categories endpoint. These are purely cosmetic UI
 * constants shared across register-finish, upload-product and the Home filter
 * so they stay in sync. (The only real "category" concept is the user tier
 * CategoriaUsuario and subasta.categoria_minima, which are unrelated.)
 */

export const PRODUCT_CATEGORIES = [
  'Relojes',
  'Autos',
  'Joyas',
  'Arte',
  'Vinos',
  'Coleccionables',
  'Otros',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const HOME_FILTERS = ['Todas', 'En vivo', 'Próximas'] as const;
export type HomeFilter = (typeof HOME_FILTERS)[number];
