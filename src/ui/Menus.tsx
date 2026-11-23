import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BUNDLE_NAME, BUNDLE_PRICE_LABEL, PREMIUM_PRODUCTS, purchaseProduct, type Entitlements } from '../game/premium';
import { SHIPS, shipUnlocked, type ShipStyle } from '../game/ships';
import type { Profile } from './profile';

function markUi(node: unknown): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-ui', '1');
}

export function MainMenu({
  onPlay,
  onShips,
  onScores,
  onSettings,
  onPrivacy,
}: {
  onPlay: () => void;
  onShips: () => void;
  onScores: () => void;
  onSettings: () => void;
  onPrivacy: () => void;
}) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>ENDLESS</Text>
        <Text style={styles.title}>ALIEN{'\n'}SHOOTER</Text>
        <Text style={styles.body}>Drag to move. Hold the fire button. Pick up a power-up, then tap it.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Play" onPress={onPlay} style={styles.primary}>
          <Text style={styles.primaryText}>PLAY</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onShips} style={styles.button}>
          <Text style={styles.buttonText}>Ships</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onScores} style={styles.button}>
          <Text style={styles.buttonText}>High scores</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSettings} style={styles.button}>
          <Text style={styles.buttonText}>Settings</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPrivacy} style={styles.button}>
          <Text style={styles.buttonText}>Privacy</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PauseMenu({ onResume, onSettings, onQuit }: { onResume: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.wrap, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>PAUSED</Text>
        <Text style={styles.menuTitle}>HOLDING</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Resume" onPress={onResume} style={styles.primary}>
          <Text style={styles.primaryText}>RESUME</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSettings} style={styles.button}>
          <Text style={styles.buttonText}>Settings</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onQuit} style={styles.button}>
          <Text style={styles.buttonText}>Quit to menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ScoreBoard({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const rows = profile.scores.length > 0 ? profile.scores : [];
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.wrap, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>THIS DEVICE</Text>
        <Text style={styles.menuTitle}>HIGH SCORES</Text>
        <ScrollView style={styles.list}>
          {rows.length === 0 ? <Text style={styles.body}>No runs yet. Finish a game and the top 10 stay here.</Text> : null}
          {rows.map((entry, index) => (
            <Text key={`${entry.at}-${index}`} style={styles.row}>
              {index + 1}. {entry.score.toLocaleString('en-US')} · wave {entry.wave}
            </Text>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.primary}>
          <Text style={styles.primaryText}>CLOSE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ShipPreview({ shipId, wing, hull }: { shipId: string; wing: string; hull: string }) {
  if (shipId === 'festive') {
    return (
      <View style={styles.preview}>
        <View style={[styles.roof, { borderBottomColor: '#7A4828' }]} />
        <View style={[styles.house, { backgroundColor: wing }]} />
        <View style={styles.gum} />
      </View>
    );
  }
  return (
    <View style={styles.preview}>
      <View style={[styles.previewWing, { backgroundColor: wing, left: 2 }]} />
      <View style={[styles.previewWing, { backgroundColor: wing, right: 2 }]} />
      <View style={[styles.previewHull, { backgroundColor: hull }]} />
      {shipId === 'superpink' ? (
        <>
          <View style={[styles.bow, { left: 1, backgroundColor: '#FF4FA3' }]} />
          <View style={[styles.bow, { right: 1, backgroundColor: '#FFB3D9' }]} />
        </>
      ) : null}
      {shipId === 'megadark' ? <View style={styles.darkEye} /> : null}
    </View>
  );
}

export function ShipSelect({
  profile,
  entitlements,
  onSelect,
  onClose,
}: {
  profile: Profile;
  entitlements: Entitlements;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [offer, setOffer] = useState<ShipStyle | 'bundle' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const offerShip = offer && offer !== 'bundle' ? offer : SHIPS.find((ship) => ship.id === 'superpink')!;
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.wrap, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>SAME HANDLING</Text>
        <Text style={styles.menuTitle}>SHIPS</Text>
        <Text style={styles.body}>Same handling. SuperPink, Festive, and MegaDark are optional. This game has no ads.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`All three ${BUNDLE_PRICE_LABEL}`} onPress={() => { setNotice(null); setOffer('bundle'); }} style={styles.bundle}>
          <Text style={styles.bundleName}>{BUNDLE_NAME}</Text>
          <Text style={styles.bundlePrice}>{BUNDLE_PRICE_LABEL}</Text>
        </Pressable>
        <ScrollView style={styles.list}>
          {SHIPS.map((ship) => {
            const open = shipUnlocked(ship, profile.bestScore, profile.bestWave, entitlements);
            const selected = profile.shipId === ship.id;
            const need = ship.premium ? 'Premium' : ship.score === 0 ? 'Ready' : `Score ${ship.score.toLocaleString('en-US')} or wave ${ship.wave}`;
            return (
              <Pressable
                key={ship.id}
                accessibilityRole="button"
                accessibilityLabel={ship.premium && !open ? `${ship.name} ${ship.priceLabel}` : ship.name}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (ship.premium && !open) {
                    setNotice(null);
                    setOffer(ship);
                    return;
                  }
                  if (open) onSelect(ship.id);
                }}
                style={[styles.ship, selected ? styles.shipOn : null, open ? null : styles.shipLocked]}
              >
                <ShipPreview shipId={ship.id} wing={ship.wing} hull={ship.hull} />
                <View style={styles.shipCopy}>
                  <Text style={styles.shipName}>{ship.name}</Text>
                  <Text style={styles.shipNeed}>{!open ? need : selected ? 'Selected' : 'Unlocked'}</Text>
                </View>
                {ship.premium && !open ? (
                  <View style={styles.priceTag}>
                    <LockMark />
                    <Text style={styles.priceText}>{ship.priceLabel}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.primary}>
          <Text style={styles.primaryText}>CLOSE</Text>
        </Pressable>
      </View>
      {offer ? (
        <View style={styles.sheetScrim}>
          <View style={styles.sheet}>
            {offer === 'bundle' ? (
              <View style={styles.bundleRow}>
                {SHIPS.filter((ship) => ship.premium).map((ship) => (
                  <ShipPreview key={ship.id} shipId={ship.id} wing={ship.wing} hull={ship.hull} />
                ))}
              </View>
            ) : (
              <ShipPreview shipId={offerShip.id} wing={offerShip.wing} hull={offerShip.hull} />
            )}
            <Text style={styles.sheetTitle}>{offer === 'bundle' ? BUNDLE_NAME : offerShip.name}</Text>
            <Text style={styles.body}>{offer === 'bundle' ? 'SuperPink, Festive, and MegaDark.' : 'Same handling. This theme restyles shots and power-ups.'}</Text>
            <Text style={styles.sheetPrice}>{offer === 'bundle' ? BUNDLE_PRICE_LABEL : offerShip.priceLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buy"
              onPress={() => setNotice(purchaseProduct(offer === 'bundle' ? PREMIUM_PRODUCTS.bundle : offerShip.productId ?? PREMIUM_PRODUCTS.bundle).message)}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Buy {offer === 'bundle' ? BUNDLE_PRICE_LABEL : offerShip.priceLabel}</Text>
            </Pressable>
            {offer !== 'bundle' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Bundle" onPress={() => setNotice(purchaseProduct(PREMIUM_PRODUCTS.bundle).message)} style={styles.button}>
                <Text style={styles.buttonText}>Bundle {BUNDLE_PRICE_LABEL}</Text>
              </Pressable>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => setOffer(null)} style={styles.button}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function LockMark() {
  return (
    <View style={styles.lock}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}

export function PrivacyPage({ onClose }: { onClose: () => void }) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.wrap, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>PLACEHOLDER</Text>
        <Text style={styles.menuTitle}>PRIVACY</Text>
        <ScrollView style={styles.list}>
          <Text style={styles.body}>
            This game stores scores, the selected ship, controls, tutorial progress, and sound settings on this device only. It does not create an account, sell data, show ads, or send analytics. Monetization is optional premium ships only. There is no product that removes ads.
          </Text>
          <Text style={styles.body}>
            Feedback opens your mail app. That message leaves the device only if you send it. Vibration, if you leave it on, stays on the phone.
          </Text>
          <Text style={styles.body}>Publisher, the public privacy URL, and the store listing name are still placeholders.</Text>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.primary}>
          <Text style={styles.primaryText}>CLOSE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  scrim: {
    backgroundColor: 'rgba(4, 8, 16, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.35)',
    backgroundColor: 'rgba(8, 14, 28, 0.94)',
    padding: 18,
  },
  kicker: {
    color: '#7EF0FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#F4FBFF',
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 8,
  },
  menuTitle: {
    color: '#F4FBFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  body: {
    color: '#D5E2F2',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  primary: {
    marginTop: 8,
    backgroundColor: '#7EF0FF',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#071018',
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 244, 255, 0.28)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#F4FBFF',
    fontWeight: '700',
  },
  list: {
    maxHeight: 280,
  },
  row: {
    color: '#F4FBFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  ship: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 244, 255, 0.2)',
    padding: 10,
    marginBottom: 8,
  },
  shipOn: {
    borderColor: '#7EF0FF',
  },
  shipLocked: {
    opacity: 0.45,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  preview: {
    width: 36,
    height: 36,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  previewHull: {
    width: 10,
    height: 22,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  previewWing: {
    position: 'absolute',
    bottom: 6,
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  bow: {
    position: 'absolute',
    bottom: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: {
    width: 18,
    height: 12,
    borderRadius: 2,
  },
  gum: {
    position: 'absolute',
    top: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E23B3B',
  },
  darkEye: {
    position: 'absolute',
    bottom: 14,
    width: 8,
    height: 2,
    backgroundColor: '#E10600',
  },
  shipCopy: {
    flex: 1,
  },
  shipName: {
    color: '#F4FBFF',
    fontWeight: '800',
  },
  shipNeed: {
    color: '#9BB0C9',
    fontSize: 12,
    marginTop: 2,
  },
  priceTag: {
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    color: '#FFE7A0',
    fontSize: 12,
    fontWeight: '800',
  },
  lock: {
    width: 14,
    height: 12,
    alignItems: 'center',
  },
  lockShackle: {
    width: 8,
    height: 5,
    borderWidth: 1.5,
    borderColor: '#F4FBFF',
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  lockBody: {
    width: 12,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#F4FBFF',
    marginTop: -1,
  },
  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 231, 160, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 231, 160, 0.08)',
  },
  bundleName: {
    color: '#FFE7A0',
    fontWeight: '800',
  },
  bundlePrice: {
    color: '#FFF6D8',
    fontWeight: '800',
  },
  bundleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4, 8, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232, 244, 255, 0.24)',
    backgroundColor: '#101826',
    padding: 18,
    alignItems: 'center',
  },
  sheetTitle: {
    color: '#F4FBFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  sheetPrice: {
    color: '#FFE7A0',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  notice: {
    color: '#9BB0C9',
    marginTop: 8,
    fontWeight: '700',
  },
});
