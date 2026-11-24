import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import type { Mode, PowerKind } from '../game/types';
import {
  elementBounds,
  elementLabel,
  gearRect,
  laserStickRect,
  pauseRect,
  type Field,
  type HudElement,
  type HudElementId,
  type HudLayout,
} from './hudLayout';
import type { TutorialCue } from './tutorial';
import type { AudioSettings } from '../audio/arcade';
import type { ControlScheme } from './controlsMode';
import { AbilityGlyph } from './AbilityGlyph';
import { FeedbackForm, RatingPrompt } from './FeedbackForm';
import { MainMenu, PauseMenu, PrivacyPage, ScoreBoard, ShipSelect } from './Menus';
import type { Entitlements } from '../game/premium';
import type { Profile } from './profile';
import { markFireZone, markIgnoresPointer, markLaserZone } from '../web/bindControls';

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
  missileLeft: number;
  stickX: number;
  stickY: number;
  fireHeld: boolean;
  wave: number;
  laserAimX: number;
  laserAimY: number;
  laserHint: boolean;
  shipId: string;
  guideOn: boolean;
  guideX: number;
  guideY: number;
}

export type UiMode = 'none' | 'settings' | 'editor' | 'buttons' | 'feedback' | 'pause' | 'scores' | 'ships' | 'privacy';

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
  onOpenFeedback: () => void;
  ratingOffer: boolean;
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
  onEditHud: () => void;
  onEditButtons: () => void;
  onResetButtons: () => void;
  onDoneEditing: () => void;
  onSelect: (id: HudElementId) => void;
  onPlace: (id: HudElementId, x: number, y: number) => void;
  onPlaceEnd: () => void;
  onPatch: (id: HudElementId, patch: Partial<Pick<HudElement, 'scale' | 'opacity' | 'visible'>>) => void;
  onResetLayout: () => void;
  audio: AudioSettings;
  onAudio: (patch: Partial<AudioSettings>) => void;
  scheme: ControlScheme;
  onScheme: (scheme: ControlScheme) => void;
  profile: Profile;
  entitlements: Entitlements;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onOpenScores: () => void;
  onOpenShips: () => void;
  onOpenPrivacy: () => void;
  onSelectShip: (id: string) => void;
  closeLabel: string;
}

const GHOSTS: PowerKind[] = ['rapid', 'bomb', 'laser'];

function markUi(node: unknown): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-ui', '1');
}

function markSlot(node: unknown, index: number): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-slot', String(index));
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
  onOpenFeedback,
  ratingOffer,
  onRate,
  onLater,
  onNever,
  onEditHud,
  onEditButtons,
  onResetButtons,
  onDoneEditing,
  onSelect,
  onPlace,
  onPlaceEnd,
  onPatch,
  onResetLayout,
  audio,
  onAudio,
  scheme,
  onScheme,
  profile,
  entitlements,
  onPlay,
  onPause,
  onResume,
  onQuit,
  onOpenScores,
  onOpenShips,
  onOpenPrivacy,
  onSelectShip,
  closeLabel,
}: Props) {
  const playing = model.mode === 'playing';
  const editingHud = ui === 'editor';
  const editingButtons = ui === 'buttons';
  const editing = editingHud || editingButtons;
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
            if (editingButtons && element.id !== 'fire' && element.id !== 'inventory' && element.id !== 'joystick') return null;
            if (element.id === 'joystick' && scheme !== 'joystick' && !editingHud) return null;
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
      {playing && !editing ? <FireCatcher layout={layout} field={field} /> : null}
      {playing && model.laserTimer > 0 ? (
        <LaserAimStick field={field} layout={layout} aimX={model.laserAimX} aimY={model.laserAimY} hint={model.laserHint} armed />
      ) : null}

      {playing && ui === 'none' && cue ? (
        <TutorialPrompt
          cue={cue}
          field={field}
          finePointer={finePointer}
          inventory={inventory ?? null}
          count={Math.max(1, model.inventory.length)}
          scheme={scheme}
          guide={model.guideOn ? { x: model.guideX, y: model.guideY } : null}
        />
      ) : null}

      {playing && ui === 'none' && model.hint && !cue ? (
        <Text pointerEvents="none" style={[styles.hint, { bottom: hintBottom(layout, field, model) }]}>{model.hint}</Text>
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
          <Text style={styles.kicker}>WAVE {model.wave}</Text>
          <Text style={styles.bannerTitle}>{model.sectorName.toUpperCase()}</Text>
        </View>
      ) : null}
      {model.mode === 'ready' && ui === 'none' ? (
        <MainMenu onPlay={onPlay} onShips={onOpenShips} onScores={onOpenScores} onSettings={onOpenSettings} onPrivacy={onOpenPrivacy} />
      ) : null}
      {model.mode === 'over' && ui === 'none' ? <GameOver model={model} /> : null}
      {ratingOffer && model.mode === 'over' && ui === 'none' ? (
        <RatingPrompt score={model.score} onRate={onRate} onLater={onLater} onNever={onNever} />
      ) : null}

      {playing && ui === 'none' ? <PauseButton rect={pauseRect(field)} onPress={onPause} /> : null}
      {ui === 'none' && model.mode !== 'ready' ? <GearButton rect={gear} onPress={onOpenSettings} /> : null}
      {ui === 'pause' ? <PauseMenu onResume={onResume} onSettings={onOpenSettings} onQuit={onQuit} /> : null}
      {ui === 'scores' ? <ScoreBoard profile={profile} onClose={onCloseUi} /> : null}
      {ui === 'ships' ? <ShipSelect profile={profile} entitlements={entitlements} onSelect={onSelectShip} onClose={onCloseUi} /> : null}
      {ui === 'privacy' ? <PrivacyPage onClose={onCloseUi} /> : null}
      {ui === 'settings' ? (
        <SettingsMenu
          paused={playing}
          onClose={onCloseUi}
          onReplay={onReplayTutorial}
          onFeedback={onOpenFeedback}
          onEdit={onEditHud}
          onEditButtons={onEditButtons}
          audio={audio}
          onAudio={onAudio}
          scheme={scheme}
          onScheme={onScheme}
          closeLabel={closeLabel}
        />
      ) : null}
      {ui === 'feedback' ? <FeedbackForm onClose={onCloseUi} /> : null}
      {editingButtons ? (
        <ButtonLayoutBar field={field} onReset={onResetButtons} onDone={onDoneEditing} />
      ) : null}
      {editingHud ? (
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
      ref={(node) => {
        const element = node as { setAttribute?: (name: string, value: string) => void; removeAttribute?: (name: string) => void } | null;
        if (!element?.setAttribute || !element.removeAttribute) return;
        if (editing) element.setAttribute('data-alien-ui', '1');
        else element.removeAttribute('data-alien-ui');
      }}
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
  if (element.id === 'joystick') {
    const knob = Math.min(width, height) * 0.34;
    const travel = Math.min(width, height) * 0.22;
    return (
      <View style={styles.pad}>
        <View style={styles.stickBase} />
        <View
          style={[
            styles.stickKnob,
            {
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              left: width / 2 - knob / 2 + model.stickX * travel,
              top: height / 2 - knob / 2 + model.stickY * travel,
            },
          ]}
        />
      </View>
    );
  }
  if (element.id === 'fire') {
    return (
      <View style={styles.pad}>
        <View style={[styles.firePad, model.fireHeld ? styles.firePadHeld : null]}>
          <View style={styles.fireMark} />
        </View>
      </View>
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
        {model.missileLeft > 0 ? <Text style={[styles.timer, { fontSize: 12 * scale }]}>SWARM {model.missileLeft}</Text> : null}
      </View>
    );
  }
  const slots = model.inventory.length > 0 ? model.inventory : editing ? GHOSTS : [];
  const slot = 46 * scale;
  const gap = 6 * scale;
  return (
    <View style={[styles.inventory, { width, height, gap }]}>
      {slots.map((kind, index) => (
        <View
          key={`${kind}-${index}`}
          ref={(node) => markSlot(node, index)}
          collapsable={false}
          pointerEvents="auto"
          style={[
            styles.slot,
            {
              width: slot,
              height: slot,
              borderRadius: slot / 2,
              opacity: model.inventory.length === 0 ? 0.45 : model.powerOn && !editing && kind !== 'shield' && kind !== 'warp' ? 0.38 : 1,
            },
          ]}
        >
          <AbilityGlyph kind={kind} size={slot} shipId={model.shipId} />
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

function PauseButton({ rect, onPress }: { rect: { x: number; y: number; w: number; h: number }; onPress: () => void }) {
  return (
    <View ref={markUi} collapsable={false} style={[styles.gearButton, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause" onPress={onPress} style={styles.gearPress}>
        <View style={styles.pauseMark}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </View>
      </Pressable>
    </View>
  );
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

function StartCard({ finePointer, scheme }: { finePointer: boolean; scheme: ControlScheme }) {
  return (
    <View pointerEvents="none" style={styles.cardWrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>MOBILE DEMO</Text>
        <Text style={styles.title}>ALIEN{'\n'}SHOOTER</Text>
        {scheme === 'joystick' ? (
          <>
            <Text style={styles.body}>Drag the stick on the left to move the ship.</Text>
            <Text style={styles.body}>Hold the fire button on the right to shoot. Lift it to stop.</Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>Drag on the left to move the ship. It follows your finger.</Text>
            <Text style={styles.body}>Hold the fire button on the right to shoot. Lift it to stop.</Text>
          </>
        )}
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
        <Text style={styles.best}>BEST {formatScore(model.best)} · WAVE {model.wave}</Text>
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
  onFeedback,
  onEdit,
  onEditButtons,
  audio,
  onAudio,
  scheme,
  onScheme,
  closeLabel,
}: {
  paused: boolean;
  onClose: () => void;
  onReplay: () => void;
  onFeedback: () => void;
  onEdit: () => void;
  onEditButtons: () => void;
  audio: AudioSettings;
  onAudio: (patch: Partial<AudioSettings>) => void;
  scheme: ControlScheme;
  onScheme: (scheme: ControlScheme) => void;
  closeLabel: string;
}) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.cardWrap, styles.menuScrim]}>
      {MENU_STARS.map((star, index) => (
        <View key={index} pointerEvents="none" style={[styles.menuStar, { left: star.left, top: star.top, width: star.size, height: star.size }]} />
      ))}
      <View style={styles.card}>
        <Text style={styles.kicker}>{paused ? 'PAUSED' : 'OPTIONS'}</Text>
        <Text style={styles.menuTitle}>SETTINGS</Text>
        <Text style={styles.menuBody}>Tutorials, controls, and the HUD layout stay on this device.</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.schemeLabel}>Joystick</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: scheme === 'joystick' }}
            accessibilityLabel="Joystick"
            onPress={() => onScheme(scheme === 'joystick' ? 'drag' : 'joystick')}
            style={[styles.toggle, scheme === 'joystick' ? styles.toggleOn : null]}
          >
            <View style={[styles.toggleKnob, scheme === 'joystick' ? styles.toggleKnobOn : null]} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onReplay} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Replay tutorial</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Edit HUD</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEditButtons} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Edit button layout</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onFeedback} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Feedback</Text>
        </Pressable>
        <Text style={styles.menuBody}>Sound and haptics stay on this device.</Text>
        <VolumeRow label="Music" value={audio.music} on={audio.musicOn} onToggle={() => onAudio({ musicOn: !audio.musicOn })} onChange={(music) => onAudio({ music })} />
        <VolumeRow label="SFX" value={audio.sfx} on={audio.sfxOn} onToggle={() => onAudio({ sfxOn: !audio.sfxOn })} onChange={(sfx) => onAudio({ sfx })} />
        <View style={styles.toggleRow}>
          <Text style={styles.schemeLabel}>Vibration</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: audio.vibrate }}
            accessibilityLabel="Vibration"
            onPress={() => onAudio({ vibrate: !audio.vibrate })}
            style={[styles.toggle, audio.vibrate ? styles.toggleOn : null]}
          >
            <View style={[styles.toggleKnob, audio.vibrate ? styles.toggleKnobOn : null]} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.menuPrimary}>
          <Text style={styles.menuPrimaryText}>{closeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ButtonLayoutBar({ field, onReset, onDone }: { field: Field; onReset: () => void; onDone: () => void }) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={[styles.editor, { top: field.top + 8 }]}>
      <Text style={styles.editorTitle}>Button layout</Text>
      <Text style={styles.menuBody}>Drag the fire button, ability slots, and the joystick when it is on.</Text>
      <Pressable accessibilityRole="button" onPress={onReset} style={styles.menuButton}>
        <Text style={styles.menuButtonText}>Reset layout</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.menuPrimary}>
        <Text style={styles.menuPrimaryText}>Done</Text>
      </Pressable>
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

function VolumeRow({
  label,
  value,
  on,
  onToggle,
  onChange,
}: {
  label: string;
  value: number;
  on: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
}) {
  const bump = (delta: number) => onChange(Math.min(1, Math.max(0, Math.round((value + delta) * 20) / 20)));
  return (
    <View style={styles.volumeRow}>
      <Text style={styles.volumeLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} quieter`} onPress={() => bump(-0.1)} style={styles.volumeStep}>
        <Text style={styles.volumeStepText}>−</Text>
      </Pressable>
      <View style={styles.volumeTrack}>
        <View style={[styles.volumeFill, { width: `${Math.round(value * 100)}%` }]} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} louder`} onPress={() => bump(0.1)} style={styles.volumeStep}>
        <Text style={styles.volumeStepText}>+</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={on ? `Mute ${label}` : `Unmute ${label}`} onPress={onToggle} style={styles.volumeMute}>
        <Text style={styles.volumeMuteText}>{on ? 'On' : 'Off'}</Text>
      </Pressable>
    </View>
  );
}

function LaserAimStick({
  field,
  layout,
  aimX,
  aimY,
  hint,
  armed,
}: {
  field: Field;
  layout: HudLayout;
  aimX: number;
  aimY: number;
  hint: boolean;
  armed: boolean;
}) {
  const stick = laserStickRect(field, layout);
  const travel = stick.w * 0.28;
  const knob = stick.w * 0.34;
  const dx = Math.max(-travel, Math.min(travel, aimX));
  const dy = Math.max(-travel, Math.min(travel, aimY));
  return (
    <>
      <View
        ref={(node) => {
          markLaserZone(node);
          if (!armed) markIgnoresPointer(node);
        }}
        collapsable={false}
        pointerEvents={armed ? 'auto' : 'none'}
        accessibilityLabel="Aim laser"
        style={[styles.laserStick, { left: stick.x, top: stick.y, width: stick.w, height: stick.h }]}
      >
        <View style={styles.laserBase} />
        <View
          pointerEvents="none"
          style={[
            styles.laserKnob,
            {
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              left: stick.w / 2 - knob / 2 + dx,
              top: stick.h / 2 - knob / 2 + dy,
            },
          ]}
        />
      </View>
      {hint ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.laserHint,
              {
                left: Math.max(8, Math.min(stick.x + stick.w / 2 - 54, field.width - 116)),
                top: Math.max(field.top + 8, stick.y - 52),
                width: 108,
              },
            ]}
          >
            <Text style={styles.laserHintText}>Aim laser</Text>
          </View>
          <View pointerEvents="none" style={[styles.laserHintArrow, { left: stick.x + stick.w / 2 - 9, top: Math.max(field.top + 28, stick.y - 16) }]} />
        </>
      ) : null}
    </>
  );
}

function FireCatcher({ layout, field }: { layout: HudLayout; field: Field }) {
  const fire = layout.elements.find((element) => element.id === 'fire');
  if (!fire?.visible) return null;
  const bounds = elementBounds(fire, field, 1);
  return (
    <View
      ref={markFireZone}
      collapsable={false}
      pointerEvents="auto"
      accessibilityLabel="Fire button"
      style={[styles.fireZone, { left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }]}
    />
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
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
  fireZone: {
    position: 'absolute',
    zIndex: 30,
    backgroundColor: 'transparent',
  },
  laserStick: {
    position: 'absolute',
    zIndex: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  laserBase: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 120, 48, 0.9)',
    backgroundColor: 'rgba(40, 16, 8, 0.55)',
  },
  laserKnob: {
    position: 'absolute',
    backgroundColor: '#FFB089',
  },
  laserHint: {
    position: 'absolute',
    zIndex: 29,
    alignItems: 'center',
  },
  laserHintArrow: {
    position: 'absolute',
    zIndex: 29,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFE7D2',
  },
  laserHintText: {
    color: '#FFE7D2',
    fontFamily: font,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
  pauseMark: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 1,
    backgroundColor: '#7EF0FF',
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
  pad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickBase: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(126, 240, 255, 0.75)',
    backgroundColor: 'rgba(8, 14, 28, 0.42)',
  },
  stickKnob: {
    position: 'absolute',
    backgroundColor: '#7EF0FF',
  },
  firePad: {
    width: '86%',
    height: '86%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#FF5A3A',
    backgroundColor: 'rgba(255, 90, 58, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firePadHeld: {
    backgroundColor: 'rgba(255, 90, 58, 0.82)',
    borderColor: '#FFF6C8',
  },
  fireMark: {
    width: '18%',
    height: '42%',
    borderRadius: 3,
    backgroundColor: '#FFF6C8',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.45)',
    backgroundColor: 'rgba(8, 14, 28, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#7EF0FF',
    borderColor: '#7EF0FF',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#9BB0C9',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#071018',
  },
  schemeLabel: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  schemeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  schemeButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  schemeOn: {
    backgroundColor: '#7EF0FF',
    borderColor: '#7EF0FF',
  },
  schemeText: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 13,
    fontWeight: '700',
  },
  schemeTextOn: {
    color: '#071018',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  volumeLabel: {
    width: 46,
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 12,
    fontWeight: '700',
  },
  volumeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(126, 240, 255, 0.16)',
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: '#7EF0FF',
  },
  volumeStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeStepText: {
    color: '#7EF0FF',
    fontFamily: font,
    fontSize: 16,
    fontWeight: '700',
  },
  volumeMute: {
    minWidth: 42,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeMuteText: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 11,
    fontWeight: '700',
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
