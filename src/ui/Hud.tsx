import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import type { Mode, PowerKind } from '../game/types';
import {
  elementBounds,
  elementLabel,
  gearRect,
  type Field,
  type HudElement,
  type HudElementId,
  type HudLayout,
} from './hudLayout';
import type { TutorialCue } from './tutorial';

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
  sectorName: string;
  sectorBanner: number;
  bossHp: number;
  bossMax: number;
  shieldTimer: number;
  wingmanTimer: number;
  warpTimer: number;
}

export type UiMode = 'none' | 'settings' | 'editor';

interface Props {
  model: HudModel;
  layout: HudLayout;
  field: Field;
  finePointer: boolean;
  cue: TutorialCue;
  ui: UiMode;
  selected: HudElementId;
  onOpenSettings: () => void;
  onCloseUi: () => void;
  onReplayTutorial: () => void;
  onEditHud: () => void;
  onDoneEditing: () => void;
  onSelect: (id: HudElementId) => void;
  onPlace: (id: HudElementId, x: number, y: number) => void;
  onPlaceEnd: () => void;
  onPatch: (id: HudElementId, patch: Partial<Pick<HudElement, 'scale' | 'opacity' | 'visible'>>) => void;
  onResetLayout: () => void;
}

const GHOSTS: PowerKind[] = ['rapid', 'bomb', 'laser'];

function markUi(node: unknown): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-ui', '1');
}

export function Overlay({
  model,
  layout,
  field,
  finePointer,
  cue,
  ui,
  selected,
  onOpenSettings,
  onCloseUi,
  onReplayTutorial,
  onEditHud,
  onDoneEditing,
  onSelect,
  onPlace,
  onPlaceEnd,
  onPatch,
  onResetLayout,
}: Props) {
  const playing = model.mode === 'playing';
  const editing = ui === 'editor';
  const inventory = layout.elements.find((element) => element.id === 'inventory');
  const inventoryCount = Math.max(model.inventory.length, editing ? 3 : 0);
  const showHud = playing || editing;
  const gear = gearRect(field);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {showHud
        ? layout.elements.map((element) => {
            if (!element.visible && !editing) return null;
            if (element.id === 'inventory' && model.inventory.length === 0 && !editing) return null;
            if (element.id === 'lowAmmo' && model.ammo > 30 && !editing) return null;
            const count = element.id === 'inventory' ? Math.max(1, inventoryCount) : 1;
            const bounds = elementBounds(element, field, count);
            return (
              <HudPiece
                key={element.id}
                element={element}
                left={bounds.x}
                top={bounds.y}
                width={bounds.w}
                height={bounds.h}
                editing={editing}
                selected={selected === element.id}
                badge={editing && !element.visible ? 'HIDDEN' : null}
                onSelect={() => onSelect(element.id)}
                onPlace={(x, y) => onPlace(element.id, x, y)}
                onPlaceEnd={onPlaceEnd}
              >
                <ElementBody element={element} model={model} editing={editing} width={bounds.w} height={bounds.h} />
              </HudPiece>
            );
          })
        : null}

      {playing && ui === 'none' && cue ? (
        <TutorialPrompt cue={cue} field={field} finePointer={finePointer} inventory={inventory ?? null} count={Math.max(1, model.inventory.length)} />
      ) : null}

      {playing && ui === 'none' && model.hint && !cue ? (
        <Text style={[styles.hint, { bottom: hintBottom(layout, field, model) }]}>{model.hint}</Text>
      ) : null}

      {model.mode === 'playing' && model.bossMax > 0 ? (
        <View pointerEvents="none" style={[styles.bossWrap, { top: field.top + 28 }]}>
          <Text style={styles.bossLabel}>BOSS</Text>
          <View style={styles.bossTrack}>
            <View style={[styles.bossFill, { width: `${Math.max(0, Math.min(1, model.bossHp / model.bossMax)) * 100}%` }]} />
          </View>
        </View>
      ) : null}
      {model.mode === 'playing' && model.sectorBanner > 0.15 ? (
        <View pointerEvents="none" style={styles.bannerWrap}>
          <Text style={styles.kicker}>SECTOR</Text>
          <Text style={styles.bannerTitle}>{model.sectorName.toUpperCase()}</Text>
        </View>
      ) : null}
      {model.mode === 'ready' && ui === 'none' ? <StartCard finePointer={finePointer} /> : null}
      {model.mode === 'over' && ui === 'none' ? <GameOver model={model} /> : null}

      {ui === 'none' ? <GearButton rect={gear} onPress={onOpenSettings} /> : null}
      {ui === 'settings' ? (
        <SettingsMenu
          paused={playing}
          onClose={onCloseUi}
          onReplay={onReplayTutorial}
          onEdit={onEditHud}
        />
      ) : null}
      {editing ? (
        <EditorBar
          field={field}
          element={layout.elements.find((element) => element.id === selected) ?? layout.elements[0]}
          onPatch={onPatch}
          onReset={onResetLayout}
          onDone={onDoneEditing}
        />
      ) : null}
    </View>
  );
}

function hintBottom(layout: HudLayout, field: Field, model: HudModel): number {
  const inventory = layout.elements.find((element) => element.id === 'inventory');
  if (!inventory || !inventory.visible || model.inventory.length === 0) return Math.max(28, field.bottom + 18);
  const bounds = elementBounds(inventory, field, model.inventory.length);
  if (bounds.y > field.height * 0.55) return Math.max(28, field.height - bounds.y + 10);
  return Math.max(28, field.bottom + 18);
}

function HudPiece({
  element,
  left,
  top,
  width,
  height,
  editing,
  selected,
  badge,
  onSelect,
  onPlace,
  onPlaceEnd,
  children,
}: {
  element: HudElement;
  left: number;
  top: number;
  width: number;
  height: number;
  editing: boolean;
  selected: boolean;
  badge: string | null;
  onSelect: () => void;
  onPlace: (x: number, y: number) => void;
  onPlaceEnd: () => void;
  children: ReactNode;
}) {
  const pos = useRef({ left, top });
  pos.current = { left, top };
  const cb = useRef({ onSelect, onPlace, onPlaceEnd });
  cb.current = { onSelect, onPlace, onPlaceEnd };
  const drag = useRef<{ left: number; top: number; x: number; y: number } | null>(null);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cb.current.onSelect();
        drag.current = { left: pos.current.left, top: pos.current.top, x: 0, y: 0 };
      },
      onPanResponderMove: (_event, gesture) => {
        const origin = drag.current;
        if (!origin) return;
        cb.current.onPlace(origin.left + gesture.dx, origin.top + gesture.dy);
      },
      onPanResponderRelease: () => {
        drag.current = null;
        cb.current.onPlaceEnd();
      },
      onPanResponderTerminate: () => {
        drag.current = null;
        cb.current.onPlaceEnd();
      },
    }),
  ).current;

  const webHandlers =
    Platform.OS === 'web'
      ? {
          onPointerDown: (event: GestureResponderEvent) => {
            const native = event.nativeEvent as unknown as { pageX?: number; pageY?: number; clientX?: number; clientY?: number; pointerId?: number };
            const node = event.currentTarget as unknown as { setPointerCapture?: (id: number) => void };
            node.setPointerCapture?.(native.pointerId ?? 1);
            cb.current.onSelect();
            drag.current = {
              left: pos.current.left,
              top: pos.current.top,
              x: native.pageX ?? native.clientX ?? 0,
              y: native.pageY ?? native.clientY ?? 0,
            };
          },
          onPointerMove: (event: GestureResponderEvent) => {
            const origin = drag.current;
            if (!origin) return;
            const native = event.nativeEvent as unknown as { pageX?: number; pageY?: number; clientX?: number; clientY?: number };
            const x = native.pageX ?? native.clientX ?? origin.x;
            const y = native.pageY ?? native.clientY ?? origin.y;
            cb.current.onPlace(origin.left + x - origin.x, origin.top + y - origin.y);
          },
          onPointerUp: () => {
            if (!drag.current) return;
            drag.current = null;
            cb.current.onPlaceEnd();
          },
        }
      : null;

  return (
    <View
      ref={markUi}
      collapsable={false}
      pointerEvents={editing ? 'auto' : 'none'}
      {...(editing && Platform.OS !== 'web' ? pan.panHandlers : null)}
      {...(editing && webHandlers ? (webHandlers as object) : null)}
      style={[
        styles.piece,
        {
          left,
          top,
          width,
          height,
          opacity: element.visible ? element.opacity : 0.45,
          borderColor: editing ? (selected ? '#7EF0FF' : 'rgba(126, 240, 255, 0.35)') : 'transparent',
          backgroundColor: editing ? 'rgba(4, 8, 18, 0.28)' : 'transparent',
        },
      ]}
    >
      {children}
      {badge ? <Text style={styles.hiddenTag}>{badge}</Text> : null}
    </View>
  );
}

function ElementBody({
  element,
  model,
  editing,
  width,
  height,
}: {
  element: HudElement;
  model: HudModel;
  editing: boolean;
  width: number;
  height: number;
}) {
  const scale = element.scale;
  if (element.id === 'score') {
    return (
      <View>
        <Text style={[styles.label, { fontSize: 11 * scale }]}>SCORE</Text>
        <Text style={[styles.score, { fontSize: 28 * scale }]}>{formatScore(model.score)}</Text>
      </View>
    );
  }
  if (element.id === 'ammo') {
    const low = model.ammo <= 30;
    const empty = model.ammo === 0;
    return (
      <View>
        <Text style={[styles.ammoLabel, { fontSize: 11 * scale }, empty ? styles.ammoEmpty : low ? styles.ammoLow : null]}>AMMO</Text>
        <Text style={[styles.ammo, { fontSize: 26 * scale }, empty ? styles.ammoEmpty : low ? styles.ammoLow : null]}>{formatScore(model.ammo)}</Text>
      </View>
    );
  }
  if (element.id === 'lowAmmo') {
    const empty = model.ammo === 0 && !editing;
    const preview = editing && model.ammo > 30;
    return (
      <View style={[styles.lowChip, empty ? styles.lowChipEmpty : null, preview ? styles.lowChipSample : null, { paddingHorizontal: 8 * scale, paddingVertical: 4 * scale }]}>
        <Text style={[styles.lowText, { fontSize: 12 * scale }, empty ? styles.ammoEmpty : null, preview ? styles.sampleText : null]}>
          {empty ? 'NO AMMO' : 'LOW AMMO'}
        </Text>
      </View>
    );
  }
  if (element.id === 'sector') {
    return (
      <Text style={[styles.sectorName, { fontSize: 12 * scale }]} numberOfLines={1}>
        {model.sectorName}
      </Text>
    );
  }
  if (element.id === 'lives') {
    return (
      <View style={styles.livesWrap}>
        <View style={styles.lives}>
          {Array.from({ length: 3 }, (_, index) => (
            <Text key={index} style={[styles.life, { fontSize: 16 * scale }, index < model.lives ? styles.lifeOn : styles.lifeOff]}>
              ▲
            </Text>
          ))}
        </View>
        {model.rapidTimer > 0 ? <Text style={[styles.timer, { fontSize: 12 * scale }]}>RAPID {model.rapidTimer.toFixed(1)}</Text> : null}
        {model.laserTimer > 0 ? <Text style={[styles.timerLaser, { fontSize: 12 * scale }]}>LASER {model.laserTimer.toFixed(1)}</Text> : null}
        {model.shieldTimer > 0 ? <Text style={[styles.timer, { fontSize: 12 * scale }]}>SHIELD {model.shieldTimer.toFixed(1)}</Text> : null}
        {model.wingmanTimer > 0 ? <Text style={[styles.timer, { fontSize: 12 * scale }]}>WING {model.wingmanTimer.toFixed(1)}</Text> : null}
        {model.warpTimer > 0 ? <Text style={[styles.timerLaser, { fontSize: 12 * scale }]}>WARP {model.warpTimer.toFixed(1)}</Text> : null}
      </View>
    );
  }
  const slots = model.inventory.length > 0 ? model.inventory : editing ? GHOSTS : [];
  const slot = 56 * scale;
  const gap = 8 * scale;
  return (
    <View style={[styles.inventory, { width, height, gap, opacity: model.powerOn && !editing ? 0.38 : 1 }]}>
      {slots.map((kind, index) => (
        <View
          key={`${kind}-${index}`}
          style={[
            styles.slot,
            {
              width: slot,
              height: slot,
              borderRadius: slot / 2,
              opacity: model.inventory.length === 0 ? 0.45 : 1,
            },
          ]}
        >
          <PowerGlyph kind={kind} />
        </View>
      ))}
    </View>
  );
}

function TutorialPrompt({
  cue,
  field,
  finePointer,
  inventory,
  count,
}: {
  cue: Exclude<TutorialCue, null>;
  field: Field;
  finePointer: boolean;
  inventory: HudElement | null;
  count: number;
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
  if (cue === 'power' && inventory) {
    const bounds = elementBounds(inventory, field, count);
    const pointDown = bounds.y + bounds.h / 2 > field.height * 0.42;
    const arrowTop = pointDown ? Math.max(field.top + 8, bounds.y - 28) : bounds.y + bounds.h + 6;
    return (
      <View pointerEvents="none" style={styles.overlay}>
        <Text style={[styles.powerText, { top: Math.max(field.top + 28, field.height * 0.3) }]}>Press to use</Text>
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
  const title = cue === 'move' ? 'Press anywhere to move' : 'Press again to shoot';
  const detail = cue === 'move' ? (finePointer ? 'Drag, or use WASD' : '') : finePointer ? 'Hold Space' : 'Second finger';
  return (
    <View pointerEvents="none" style={[styles.prompt, { top: Math.max(field.top + 28, field.height * 0.3) }]}>
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

function GearButton({ rect, onPress }: { rect: { x: number; y: number; w: number; h: number }; onPress: () => void }) {
  return (
    <View ref={markUi} collapsable={false} style={[styles.gearButton, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onPress} style={styles.gearPress}>
        <GearIcon />
      </Pressable>
    </View>
  );
}

function GearIcon() {
  return (
    <View style={styles.gear}>
      <View style={styles.gearHub} />
      {Array.from({ length: 8 }, (_, index) => (
        <View key={index} style={[styles.gearToothWrap, { transform: [{ rotate: `${index * 45}deg` }] }]}>
          <View style={styles.gearTooth} />
        </View>
      ))}
    </View>
  );
}

function StartCard({ finePointer }: { finePointer: boolean }) {
  return (
    <View pointerEvents="none" style={styles.cardWrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>MOBILE DEMO</Text>
        <Text style={styles.title}>ALIEN{'\n'}SHOOTER</Text>
        <Text style={styles.body}>Drag one finger to move the ship. It follows the drag, so your thumb never covers it.</Text>
        <Text style={styles.body}>Hold a second finger anywhere to fire upward. Lift it to stop.</Text>
        {finePointer ? (
          <Text style={styles.desktop}>WASD moves, Space fires. Tap a power-up icon, or press 1, 2, or 3. Point the mouse to aim the laser.</Text>
        ) : null}
        <Text style={styles.cta}>TAP TO START</Text>
      </View>
    </View>
  );
}

function GameOver({ model }: { model: HudModel }) {
  return (
    <View pointerEvents="none" style={[styles.cardWrap, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>END OF RUN</Text>
        <Text style={styles.title}>GAME{'\n'}OVER</Text>
        <Text style={styles.finalScore}>{formatScore(model.score)}</Text>
        <Text style={styles.best}>BEST {formatScore(model.best)}</Text>
        <Text style={styles.cta}>TAP TO RESTART</Text>
      </View>
    </View>
  );
}

const MENU_STARS = [
  { left: '12%', top: '18%', size: 2 },
  { left: '78%', top: '14%', size: 2 },
  { left: '22%', top: '72%', size: 1.5 },
  { left: '84%', top: '64%', size: 2 },
  { left: '48%', top: '28%', size: 1.5 },
  { left: '66%', top: '80%', size: 1.5 },
  { left: '8%', top: '46%', size: 1.5 },
  { left: '90%', top: '38%', size: 2 },
];

function SettingsMenu({
  paused,
  onClose,
  onReplay,
  onEdit,
}: {
  paused: boolean;
  onClose: () => void;
  onReplay: () => void;
  onEdit: () => void;
}) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.cardWrap, styles.menuScrim]}>
      {MENU_STARS.map((star, index) => (
        <View key={index} pointerEvents="none" style={[styles.menuStar, { left: star.left, top: star.top, width: star.size, height: star.size }]} />
      ))}
      <View style={styles.card}>
        <Text style={styles.kicker}>{paused ? 'PAUSED' : 'OPTIONS'}</Text>
        <Text style={styles.menuTitle}>SETTINGS</Text>
        <Text style={styles.menuBody}>Tutorials and the HUD layout stay on this device.</Text>
        <Pressable accessibilityRole="button" onPress={onReplay} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Replay tutorial</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Edit HUD</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.menuPrimary}>
          <Text style={styles.menuPrimaryText}>{paused ? 'Resume' : 'Close'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditorBar({
  field,
  element,
  onPatch,
  onReset,
  onDone,
}: {
  field: Field;
  element: HudElement;
  onPatch: (id: HudElementId, patch: Partial<Pick<HudElement, 'scale' | 'opacity' | 'visible'>>) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <View
      ref={markUi}
      collapsable={false}
      pointerEvents="auto"
      style={[styles.editor, { top: Math.max(field.top + 168, Math.min(field.height * 0.36, field.height - field.bottom - 340)) }]}
    >
      <Text style={styles.editorTitle}>{elementLabel(element.id)}</Text>
      <View style={styles.editorRow}>
        <Text style={styles.editorLabel}>Size</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Smaller" onPress={() => onPatch(element.id, { scale: roundTenth(element.scale - 0.1) })} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.editorValue}>{element.scale.toFixed(1)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Larger" onPress={() => onPatch(element.id, { scale: roundTenth(element.scale + 0.1) })} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.editorRow}>
        <Text style={styles.editorLabel}>Opacity</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More transparent" onPress={() => onPatch(element.id, { opacity: roundTenth(element.opacity - 0.1) })} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.editorValue}>{Math.round(element.opacity * 100)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More opaque" onPress={() => onPatch(element.id, { opacity: roundTenth(element.opacity + 0.1) })} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.editorActions}>
        <Pressable accessibilityRole="button" onPress={() => onPatch(element.id, { visible: !element.visible })} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>{element.visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onReset} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Reset to default</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.menuPrimary}>
        <Text style={styles.menuPrimaryText}>Done</Text>
      </Pressable>
    </View>
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
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
  if (kind === 'laser') {
    return (
      <View style={styles.glyph}>
        <View style={styles.beam} />
      </View>
    );
  }
  if (kind === 'shield') {
    return (
      <View style={styles.glyph}>
        <View style={styles.shieldBubble} />
      </View>
    );
  }
  if (kind === 'wingman') {
    return (
      <View style={styles.glyph}>
        <View style={[styles.drone, { left: 4 }]} />
        <View style={[styles.drone, { right: 4 }]} />
      </View>
    );
  }
  return (
    <View style={styles.glyph}>
      <View style={styles.warpRing} />
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
  piece: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
  },
  hiddenTag: {
    position: 'absolute',
    right: 4,
    top: 2,
    color: '#7EF0FF',
    fontFamily: font,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  label: {
    color: '#9BB0C9',
    fontFamily: font,
    letterSpacing: 2,
    fontWeight: '700',
  },
  score: {
    color: '#F4FBFF',
    fontFamily: font,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  ammoLabel: {
    color: '#9BB0C9',
    fontFamily: font,
    letterSpacing: 2,
    fontWeight: '700',
  },
  ammo: {
    color: '#F4FBFF',
    fontFamily: font,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ammoLow: {
    color: '#FFB020',
  },
  ammoEmpty: {
    color: '#FF5D7A',
  },
  lowChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.7)',
    backgroundColor: 'rgba(48, 28, 8, 0.82)',
  },
  lowChipEmpty: {
    borderColor: 'rgba(255, 93, 122, 0.8)',
    backgroundColor: 'rgba(48, 10, 18, 0.82)',
  },
  lowChipSample: {
    borderColor: 'rgba(155, 176, 201, 0.45)',
    backgroundColor: 'rgba(8, 14, 28, 0.55)',
  },
  sampleText: {
    color: '#9BB0C9',
  },
  lowText: {
    color: '#FFB020',
    fontFamily: font,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  livesWrap: {
    alignItems: 'flex-end',
  },
  lives: {
    flexDirection: 'row',
    gap: 4,
  },
  timer: {
    color: '#D6F6FF',
    fontFamily: font,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  timerLaser: {
    color: '#FFB089',
    fontFamily: font,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  inventory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
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
  sectorName: {
    color: '#E7F6FF',
    fontFamily: font,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bossWrap: {
    position: 'absolute',
    left: 108,
    right: 70,
    alignItems: 'center',
  },
  bossLabel: {
    color: '#FFB089',
    fontFamily: font,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bossTrack: {
    marginTop: 4,
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(8, 12, 20, 0.8)',
    overflow: 'hidden',
  },
  bossFill: {
    height: 8,
    backgroundColor: '#FF5A3A',
  },
  bannerWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '34%',
    alignItems: 'center',
  },
  bannerTitle: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  shieldBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9DEBFF',
    backgroundColor: 'rgba(157,235,255,0.2)',
  },
  drone: {
    position: 'absolute',
    top: 8,
    width: 7,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#E7F3FF',
  },
  warpRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C9D4FF',
  },
  beam: {
    width: 7,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FF5A2A',
  },
  life: {
    fontWeight: '700',
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
  },
  prompt: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  promptTitle: {
    textAlign: 'center',
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  powerText: {
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 26,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  promptDetail: {
    marginTop: 4,
    color: '#9AD7E8',
    fontFamily: font,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  finger: {
    width: 22,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 244, 255, 0.88)',
    alignItems: 'center',
    paddingTop: 4,
  },
  nail: {
    width: 10,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  arrow: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  chevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#7EF0FF',
  },
  gearButton: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: 'rgba(7, 12, 26, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.45)',
  },
  gearPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearHub: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#7EF0FF',
  },
  gearToothWrap: {
    position: 'absolute',
    width: 22,
    height: 22,
    alignItems: 'center',
  },
  gearTooth: {
    width: 4,
    height: 5,
    borderRadius: 1,
    backgroundColor: '#7EF0FF',
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
  menuScrim: {
    backgroundColor: 'rgba(3, 6, 14, 0.78)',
  },
  menuStar: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: 'rgba(214, 230, 255, 0.75)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(7, 12, 26, 0.88)',
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
  menuTitle: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  menuBody: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 14,
    lineHeight: 20,
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
  menuButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.4)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '700',
  },
  menuPrimary: {
    marginTop: 12,
    backgroundColor: '#7EF0FF',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  menuPrimaryText: {
    color: '#071018',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  editor: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(7, 12, 26, 0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.28)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editorTitle: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  editorLabel: {
    width: 68,
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 13,
    fontWeight: '700',
  },
  editorValue: {
    width: 36,
    textAlign: 'center',
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  step: {
    width: 36,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(126, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.35)',
  },
  stepText: {
    color: '#7EF0FF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  editorActions: {
    gap: 0,
  },
});
