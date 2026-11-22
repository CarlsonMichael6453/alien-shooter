import { forwardRef, useId, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { pickupBob, worldShake } from '../game/draw';
import type { GameState, PowerKind } from '../game/types';
import { SLOT_SIZE } from './hudLayout';
import {
  ABILITY_THEMES,
  LASER_BEAM,
  LASER_CORE,
  LASER_HOT,
  RAPID_BODY,
  RAPID_CORE,
  SHIELD_GLOW,
  SHIELD_HOT,
  SHIELD_NEON,
  bombArt,
  clockArt,
  hexPoints,
  missileArt,
  rapidStreaks,
  wingmanArt,
  type Point,
} from '../game/abilityArt';

export function AbilityGlyph({ kind, size }: { kind: PowerKind; size: number }) {
  const gid = `ab${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const radius = size / 2 - 1.15;
  const center = size / 2;
  const theme = ABILITY_THEMES[kind];
  const at = (points: readonly Point[]) => points.map(([x, y]) => `${(x + center).toFixed(2)},${(y + center).toFixed(2)}`).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={`${gid}-fill`} cx="50%" cy="30%" rx="64%" ry="64%">
          <Stop offset="0" stopColor={theme.highlight} />
          <Stop offset="0.46" stopColor={theme.mid} />
          <Stop offset="1" stopColor={theme.edge} />
        </RadialGradient>
        <ClipPath id={`${gid}-clip`}>
          <Circle cx={center} cy={center} r={radius} />
        </ClipPath>
      </Defs>
      <Circle cx={center} cy={center} r={radius} fill={`url(#${gid}-fill)`} />
      <G clipPath={`url(#${gid}-clip)`}>
        <Symbol kind={kind} radius={radius} center={center} at={at} />
        <Ellipse cx={center} cy={center - radius * 0.58} rx={radius * 0.84} ry={radius * 0.36} fill="#FFFFFF" opacity={0.28} />
        <Ellipse cx={center - radius * 0.06} cy={center - radius * 0.7} rx={radius * 0.36} ry={radius * 0.1} fill="#FFFFFF" opacity={0.5} />
      </G>
      <Circle cx={center} cy={center} r={radius - 0.45} stroke={theme.rim} strokeWidth={Math.max(1.15, size * 0.03)} fill="none" />
    </Svg>
  );
}

function Symbol({
  kind,
  radius,
  center,
  at,
}: {
  kind: PowerKind;
  radius: number;
  center: number;
  at: (points: readonly Point[]) => string;
}) {
  if (kind === 'rapid') {
    return (
      <>
        {rapidStreaks(radius).map((streak, index) => (
          <G key={index}>
            <Polygon points={at(streak.body)} fill={RAPID_BODY} />
            <Polygon points={at(streak.core)} fill={RAPID_CORE} />
          </G>
        ))}
      </>
    );
  }
  if (kind === 'bomb') {
    const art = bombArt(radius);
    return (
      <>
        <Polygon points={at(art.stem)} fill="#6A3018" />
        <Polygon points={at(art.stemHot)} fill="#E25822" />
        {art.lobes.map((lobe, index) => (
          <Circle key={index} cx={center + lobe.x} cy={center + lobe.y} r={lobe.r} fill={lobe.color} />
        ))}
        <Ellipse
          cx={center + art.ring.x}
          cy={center + art.ring.y}
          rx={art.ring.rx}
          ry={art.ring.ry}
          stroke={art.ring.color}
          strokeWidth={art.ring.width}
          fill="none"
        />
      </>
    );
  }
  if (kind === 'laser') {
    return (
      <>
        <Rect x={center - radius * 0.22} y={center - radius * 0.7} width={radius * 0.44} height={radius * 1.4} rx={radius * 0.1} fill="rgba(255,90,42,0.4)" />
        <Rect x={center - radius * 0.16} y={center - radius * 0.7} width={radius * 0.32} height={radius * 1.4} rx={radius * 0.08} fill={LASER_BEAM} />
        <Rect x={center - radius * 0.055} y={center - radius * 0.7} width={radius * 0.11} height={radius * 1.4} rx={radius * 0.05} fill={LASER_CORE} />
        <Rect x={center - radius * 0.02} y={center - radius * 0.58} width={radius * 0.04} height={radius * 1.16} rx={radius * 0.02} fill={LASER_HOT} />
      </>
    );
  }
  if (kind === 'shield') {
    return (
      <>
        <Polygon points={at(hexPoints(0, 0, radius * 0.58))} fill="none" stroke={SHIELD_GLOW} strokeWidth={radius * 0.16} strokeLinejoin="round" />
        <Polygon points={at(hexPoints(0, 0, radius * 0.58))} fill="none" stroke={SHIELD_NEON} strokeWidth={Math.max(1.3, radius * 0.055)} strokeLinejoin="round" />
        <Polygon points={at(hexPoints(0, 0, radius * 0.34))} fill="none" stroke={SHIELD_HOT} strokeWidth={Math.max(1.1, radius * 0.04)} strokeLinejoin="round" />
      </>
    );
  }
  if (kind === 'wingman') {
    const art = wingmanArt(radius);
    return (
      <>
        {art.outlines.map((outline, index) => (
          <Polygon key={index} points={at(outline)} fill="none" stroke="#7EF0FF" strokeWidth={Math.max(1.2, radius * 0.065)} strokeLinejoin="round" />
        ))}
        {art.dots.map((dot, index) => (
          <Circle key={index} cx={center + dot.x} cy={center + dot.y} r={dot.r} fill={dot.color} />
        ))}
      </>
    );
  }
  if (kind === 'warp') {
    const art = clockArt(radius);
    return (
      <>
        <Circle cx={center} cy={center} r={art.face} fill="rgba(244,247,255,0.16)" stroke="#F4F7FF" strokeWidth={Math.max(1.15, radius * 0.045)} />
        {art.ticks.map((tick, index) => (
          <Polygon key={index} points={at(tick)} fill="#F7F8FF" />
        ))}
        <Polygon points={at(art.hour)} fill="#FFF8E8" />
        <Polygon points={at(art.minute)} fill="#F4F7FF" />
        <Circle cx={center} cy={center} r={art.hub} fill="#FFF8E8" />
      </>
    );
  }
  const art = missileArt(radius);
  return (
    <>
      {art.missiles.map((missile, index) => (
        <G key={index}>
          <Polygon points={at(missile.body)} fill="#E2A122" />
          <Polygon points={at(missile.core)} fill="#FFE7A0" />
          <Polygon points={at(missile.tip)} fill="#D4143A" />
        </G>
      ))}
      <Circle cx={center + art.lock.x} cy={center + art.lock.y} r={art.reticle} fill="none" stroke="#FFF6D8" strokeWidth={Math.max(1, radius * 0.04)} />
      <Circle cx={center + art.lock.x} cy={center + art.lock.y} r={radius * 0.04} fill="#FF3355" />
    </>
  );
}

export interface ArenaPickupHandle {
  sync(state: GameState): void;
}

interface ArenaSpot {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
}

/** Floating ability pickups use the same badge component as the HUD slots. */
export const ArenaPickups = forwardRef<ArenaPickupHandle>(function ArenaPickups(_, ref) {
  const [spots, setSpots] = useState<ArenaSpot[]>([]);
  useImperativeHandle(ref, () => ({
    sync(state: GameState) {
      const shake = worldShake(state);
      const next: ArenaSpot[] = [];
      for (const pickup of state.pickups) {
        if (pickup.kind === 'ammo') continue;
        next.push({
          id: pickup.id,
          kind: pickup.kind,
          x: pickup.x + shake.x - SLOT_SIZE / 2,
          y: pickup.y + pickupBob(state.time, pickup.spin) + shake.y - SLOT_SIZE / 2,
        });
      }
      setSpots((prev) => (sameSpots(prev, next) ? prev : next));
    },
  }));
  return (
    <View pointerEvents="none" style={styles.layer}>
      {spots.map((spot) => (
        <View key={spot.id} pointerEvents="none" style={[styles.spot, { left: spot.x, top: spot.y }]}>
          <AbilityGlyph kind={spot.kind} size={SLOT_SIZE} />
        </View>
      ))}
    </View>
  );
});

function sameSpots(prev: readonly ArenaSpot[], next: readonly ArenaSpot[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((spot, index) => {
    const other = next[index];
    return spot.id === other.id && spot.kind === other.kind && Math.abs(spot.x - other.x) < 0.15 && Math.abs(spot.y - other.y) < 0.15;
  });
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  spot: {
    position: 'absolute',
    width: SLOT_SIZE,
    height: SLOT_SIZE,
  },
});
