import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHIPS, shipUnlocked } from './ships';
import { BUNDLE_PRICE_LABEL, EMPTY_ENTITLEMENTS, PREMIUM_PRODUCTS, SHIP_PRICE_LABEL, devUnlockAllFromLocation, hasEntitlement, purchaseProduct } from './premium';

describe('premium ships', () => {
  it('keeps score ships free and locks the three themes until an entitlement exists', () => {
    const gold = SHIPS.find((ship) => ship.id === 'gold')!;
    const pink = SHIPS.find((ship) => ship.id === 'superpink')!;
    assert.equal(gold.premium, false);
    assert.equal(shipUnlocked(gold, 15000, 1, EMPTY_ENTITLEMENTS), true);
    assert.equal(shipUnlocked(pink, 999999, 99, EMPTY_ENTITLEMENTS), false);
    assert.equal(pink.productId, PREMIUM_PRODUCTS.superpink);
    assert.equal(pink.priceLabel, SHIP_PRICE_LABEL);
    assert.equal(hasEntitlement({ owned: [PREMIUM_PRODUCTS.superpink], unlockAll: false }, PREMIUM_PRODUCTS.superpink), true);
    assert.equal(hasEntitlement({ owned: [PREMIUM_PRODUCTS.bundle], unlockAll: false }, PREMIUM_PRODUCTS.megadark), true);
    assert.equal(hasEntitlement({ owned: [], unlockAll: true }, PREMIUM_PRODUCTS.festive), true);
    assert.equal(purchaseProduct(PREMIUM_PRODUCTS.festive).message, 'Coming soon');
    assert.equal(purchaseProduct(PREMIUM_PRODUCTS.festive).ok, false);
    assert.equal(BUNDLE_PRICE_LABEL, '$3.99');
    assert.equal(devUnlockAllFromLocation('?debug=1&unlockAll=1'), true);
    assert.equal(devUnlockAllFromLocation('?debug=1'), false);
  });
});
