import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { markIgnoresPointer } from '../web/bindControls';
import { elementBounds, type Field, type HudElement } from './hudLayout';
import { styles } from './hudStyles';
import type { ControlScheme } from './controlsMode';
import type { TutorialCue } from './tutorial';

export function TutorialPrompt({
  cue,
  field,
  finePointer,
  inventory,
  count,
  scheme,
  guide,
}: {
  cue: Exclude<TutorialCue, null>;
  field: Field;
  finePointer: boolean;
  inventory: HudElement | null;
  count: number;
  scheme: ControlScheme;
  guide: { x: number; y: number } | null;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);
  if ((cue === 'ammo' || cue === 'pickup') && guide) {
    const title = cue === 'ammo' ? 'Grab ammo boxes to refill your ammo' : 'Pick up a power-up';
    const detail = cue === 'pickup' ? 'Fly into the glowing badge' : null;
    const upper = guide.y < field.height * 0.42;
    const textTop = upper
      ? Math.min(field.height * 0.7, Math.max(guide.y + 86, field.height * 0.48))
      : Math.max(field.top + 72, guide.y - 132);
    const arrowTop = upper ? guide.y + 32 : guide.y - 36;
    return (
      <View ref={markIgnoresPointer} pointerEvents="none" style={styles.overlay}>
        <View style={[styles.prompt, { top: textTop }]}>
          <Text style={styles.promptTitle}>{title}</Text>
          {detail ? <Text style={styles.promptDetail}>{detail}</Text> : null}
        </View>
        <Animated.View
          style={[
            styles.arrow,
            {
              left: guide.x - 11,
              top: arrowTop,
              transform: [
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: upper ? [4, -6] : [-4, 6] }) },
                { rotate: upper ? '180deg' : '0deg' },
              ],
            },
          ]}
        >
          <Chevron />
        </Animated.View>
      </View>
    );
  }
  if (cue === 'power' && inventory) {
    const bounds = elementBounds(inventory, field, count);
    const pointDown = bounds.y + bounds.h / 2 > field.height * 0.42;
    const arrowTop = pointDown ? Math.max(field.top + 8, bounds.y - 28) : bounds.y + bounds.h + 6;
    return (
      <View ref={markIgnoresPointer} pointerEvents="none" style={styles.overlay}>
        <Text style={[styles.powerText, { top: Math.max(field.top + 28, field.height * 0.3) }]}>Tap the icon to use it</Text>
        <Animated.View
          style={[
            styles.arrow,
            {
              left: bounds.x + bounds.w / 2 - 9,
              top: arrowTop,
              transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: pointDown ? [3, -7] : [-3, 7] }) }, { rotate: pointDown ? '0deg' : '180deg' }],
            },
          ]}
        >
          <Chevron />
        </Animated.View>
      </View>
    );
  }
  const title =
    cue === 'ammo'
      ? 'Grab ammo boxes to refill your ammo'
      : cue === 'pickup'
        ? 'Pick up a power-up'
        : scheme === 'joystick'
          ? cue === 'move'
            ? 'Drag the stick to move'
            : 'Hold the fire button'
          : cue === 'move'
            ? 'Drag to move'
            : 'Hold the fire button';
  const detail =
    cue === 'ammo' ? '' : cue === 'pickup' ? 'Fly into the glowing badge' : scheme === 'joystick' ? (cue === 'move' ? 'Left side' : 'Right side') : cue === 'move' ? 'Anywhere except the fire button' : 'Right side';
  return (
    <View ref={markIgnoresPointer} pointerEvents="none" style={[styles.prompt, { top: Math.max(field.top + 28, field.height * 0.3) }]}>
      <Text style={styles.promptTitle}>{title}</Text>
      {detail ? <Text style={styles.promptDetail}>{detail}</Text> : null}
      <Animated.View style={{ marginTop: 14, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 36] }) }] }}>
        <Finger />
      </Animated.View>
    </View>
  );
}

function Finger() {
  return (
    <View style={styles.finger}>
      <View style={styles.nail} />
    </View>
  );
}

function Chevron() {
  return <View style={styles.chevron} />;
}

