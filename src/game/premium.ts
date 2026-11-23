/**
 * Optional premium ships. There are no ads and no product that removes ads.
 * Real purchases are not wired. A later native build can grant these product ids.
 */
export const PREMIUM_PRODUCTS = {
  superpink: 'ship_superpink',
  festive: 'ship_festive',
  megadark: 'ship_megadark',
  bundle: 'bundle_premium_ships',
} as const;

export const SHIP_PRICE_LABEL = '$1.99';
export const BUNDLE_PRICE_LABEL = '$3.99';
export const BUNDLE_NAME = 'All three';

const SHIP_PRODUCTS = new Set<string>([PREMIUM_PRODUCTS.superpink, PREMIUM_PRODUCTS.festive, PREMIUM_PRODUCTS.megadark]);

export interface Entitlements {
  /** Product ids the player owns. Empty until a store purchase is recorded. */
  owned: readonly string[];
  /** Dev-only. Set from `?unlockAll=1`. A Buy button never sets this. */
  unlockAll: boolean;
}

export const EMPTY_ENTITLEMENTS: Entitlements = { owned: [], unlockAll: false };

export function hasEntitlement(entitlements: Entitlements, productId: string): boolean {
  if (entitlements.unlockAll) return true;
  if (entitlements.owned.includes(productId)) return true;
  return entitlements.owned.includes(PREMIUM_PRODUCTS.bundle) && SHIP_PRODUCTS.has(productId);
}

/** The only purchase result until RevenueCat is connected. It grants nothing. */
export function purchaseProduct(productId: string): { ok: false; productId: string; message: 'Coming soon' } {
  return { ok: false, productId, message: 'Coming soon' };
}

export function devUnlockAllFromLocation(search: string): boolean {
  return new URLSearchParams(search).get('unlockAll') === '1';
}
