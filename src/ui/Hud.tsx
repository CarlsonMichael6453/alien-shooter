import { Platform, StyleSheet, Text, View } from 'react-native';
import type { Mode, PowerKind } from '../game/types';

export interface HudModel {
  mode: Mode;
  score: number;
  best: number;
  lives: number;
  ammo: number;
  inventory: PowerKind[];
  powerOn: boolean;
  rapidTimer: number;
  laserTimer: number;
  hint: string | null;
}

interface Props {
  model: HudModel;
  top: number;
  bottom: number;
  finePointer: boolean;
}

export function Overlay({ model, top, bottom, finePointer }: Props) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {model.mode === 'playing' ? (
        <View style={[styles.hud, { paddingTop: top }]}>
          <View>
            <Text style={styles.label}>SCORE</Text>
            <Text style={styles.score}>{formatScore(model.score)}</Text>
            <Text style={[styles.ammoLabel, model.ammo === 0 ? styles.ammoEmpty : model.ammo <= 30 ? styles.ammoLow : null]}>
              AMMO
            </Text>
            <Text style={[styles.ammo, model.ammo === 0 ? styles.ammoEmpty : model.ammo <= 30 ? styles.ammoLow : null]}>
              {formatScore(model.ammo)}
            </Text>
          </View>
          <View style={styles.side}>
            <View style={styles.lives}>
              {Array.from({ length: 3 }, (_, index) => (
                <Text key={index} style={[styles.life, index < model.lives ? styles.lifeOn : styles.lifeOff]}>
                  ▲
                </Text>
              ))}
            </View>
            {model.rapidTimer > 0 ? <Text style={styles.timer}>RAPID {model.rapidTimer.toFixed(1)}</Text> : null}
            {model.laserTimer > 0 ? <Text style={styles.timerLaser}>LASER {model.laserTimer.toFixed(1)}</Text> : null}
          </View>
        </View>
      ) : null}

      {model.mode === 'playing' && model.inventory.length > 0 ? (
        <View style={[styles.inventory, { bottom: bottom + 18 }, model.powerOn ? styles.inventoryLocked : null]}>
          {model.inventory.map((kind, index) => (
            <View key={`${kind}-${index}`} style={styles.slot}>
              <PowerGlyph kind={kind} />
            </View>
          ))}
        </View>
      ) : null}

      {model.mode === 'playing' && model.hint ? (
        <Text style={[styles.hint, { bottom: bottom + (model.inventory.length > 0 ? 92 : 28) }]}>{model.hint}</Text>
      ) : null}

      {model.mode === 'ready' ? (
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.kicker}>MOBILE DEMO</Text>
            <Text style={styles.title}>ALIEN{'\n'}SHOOTER</Text>
            <Text style={styles.body}>Drag one finger to move the ship. It follows the drag, so your thumb never covers it.</Text>
            <Text style={styles.body}>Hold a second finger anywhere to fire upward. Lift it to stop.</Text>
            {finePointer ? (
              <Text style={styles.desktop}>
                WASD moves, Space fires. Tap a bottom-left icon, or press 1, 2, or 3. Point the mouse to aim the laser.
              </Text>
            ) : null}
            <Text style={styles.cta}>TAP TO START</Text>
          </View>
        </View>
      ) : null}

      {model.mode === 'over' ? (
        <View style={[styles.cardWrap, styles.scrim]}>
          <View style={styles.card}>
            <Text style={styles.kicker}>END OF RUN</Text>
            <Text style={styles.title}>GAME{'\n'}OVER</Text>
            <Text style={styles.finalScore}>{formatScore(model.score)}</Text>
            <Text style={styles.best}>BEST {formatScore(model.best)}</Text>
            <Text style={styles.cta}>TAP TO RESTART</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PowerGlyph({ kind }: { kind: PowerKind }) {
  if (kind === 'rapid') {
    return (
      <View style={styles.glyph}>
        <View style={[styles.streak, { transform: [{ rotate: '-24deg' }] }]} />
        <View style={[styles.streak, { transform: [{ rotate: '-8deg' }] }]} />
        <View style={[styles.streak, { transform: [{ rotate: '8deg' }] }]} />
        <View style={[styles.streak, { transform: [{ rotate: '24deg' }] }]} />
      </View>
    );
  }
  if (kind === 'bomb') {
    return (
      <View style={styles.glyph}>
        <View style={styles.stemShade} />
        <View style={styles.stemHot} />
        <View style={styles.lobeL} />
        <View style={styles.lobeR} />
        <View style={styles.lobeC} />
        <View style={styles.lobeHot} />
        <View style={styles.ash} />
      </View>
    );
  }
  return (
    <View style={styles.glyph}>
      <View style={styles.beam} />
    </View>
  );
}

function formatScore(value: number): string {
  return Math.max(0, Math.floor(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const font = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif-condensed',
  default: 'system-ui, sans-serif',
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  hud: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  score: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  ammoLabel: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 8,
  },
  ammo: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ammoLow: {
    color: '#FFB020',
  },
  ammoEmpty: {
    color: '#FF5D7A',
  },
  side: {
    alignItems: 'flex-end',
  },
  lives: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  timer: {
    color: '#D6F6FF',
    fontFamily: font,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  timerLaser: {
    color: '#FFB089',
    fontFamily: font,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  inventory: {
    position: 'absolute',
    left: 14,
    flexDirection: 'row',
    gap: 8,
  },
  inventoryLocked: {
    opacity: 0.38,
  },
  slot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(8, 14, 28, 0.88)',
    borderWidth: 2,
    borderColor: 'rgba(232, 244, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: {
    position: 'absolute',
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#F4FEFF',
    top: 2,
  },
  stemShade: {
    position: 'absolute',
    top: 12,
    width: 8,
    height: 13,
    borderRadius: 3,
    backgroundColor: '#4A342C',
  },
  stemHot: {
    position: 'absolute',
    top: 13,
    width: 3,
    height: 11,
    borderRadius: 2,
    backgroundColor: '#E25820',
  },
  lobeL: {
    position: 'absolute',
    top: 6,
    left: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6A3424',
  },
  lobeR: {
    position: 'absolute',
    top: 7,
    right: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#8A3A22',
  },
  lobeC: {
    position: 'absolute',
    top: 2,
    width: 14,
    height: 12,
    borderRadius: 7,
    backgroundColor: '#D04A1C',
  },
  lobeHot: {
    position: 'absolute',
    top: 3,
    width: 7,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFE0A4',
  },
  ash: {
    position: 'absolute',
    top: 5,
    left: 1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2A1C18',
  },
  beam: {
    width: 7,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FF5A2A',
  },
  life: {
    fontSize: 16,
  },
  lifeOn: {
    color: '#7EF0FF',
  },
  lifeOff: {
    color: 'rgba(244,251,255,0.22)',
  },
  hint: {
    position: 'absolute',
    left: 20,
    right: 20,
    textAlign: 'center',
    color: '#D5F7FF',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrim: {
    backgroundColor: 'rgba(4, 6, 16, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(7, 12, 26, 0.78)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.28)',
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  kicker: {
    color: '#7EF0FF',
    fontFamily: font,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
  },
  title: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 14,
  },
  body: {
    color: '#D5E2F2',
    fontFamily: font,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  desktop: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  cta: {
    marginTop: 16,
    color: '#071018',
    backgroundColor: '#7EF0FF',
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: font,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingVertical: 12,
    borderRadius: 999,
  },
  finalScore: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  best: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 14,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: 4,
  },
});
