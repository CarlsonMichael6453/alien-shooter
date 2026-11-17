import { Platform, StyleSheet, Text, View } from 'react-native';
import type { Mode } from '../game/types';

export interface HudModel {
  mode: Mode;
  score: number;
  best: number;
  lives: number;
  hint: boolean;
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
          </View>
          <View style={styles.lives}>
            {Array.from({ length: 3 }, (_, index) => (
              <Text key={index} style={[styles.life, index < model.lives ? styles.lifeOn : styles.lifeOff]}>
                ▲
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {model.mode === 'playing' && model.hint ? (
        <Text style={[styles.hint, { bottom: bottom + 28 }]}>
          {finePointer ? 'Hold Space to fire' : 'Hold a second finger to fire'}
        </Text>
      ) : null}

      {model.mode === 'ready' ? (
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.kicker}>MOBILE DEMO</Text>
            <Text style={styles.title}>ALIEN{'\n'}SHOOTER</Text>
            <Text style={styles.body}>Drag one finger to move the ship. It follows the drag, so your thumb never covers it.</Text>
            <Text style={styles.body}>Hold a second finger anywhere to fire upward. Lift it to stop.</Text>
            {finePointer ? (
              <Text style={styles.desktop}>Keyboard: WASD or arrows to move, hold Space to fire. Or drag with the mouse.</Text>
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
  lives: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
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
