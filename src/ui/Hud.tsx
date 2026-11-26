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
import { styles } from './hudStyles';
import { TutorialPrompt } from './TutorialPrompt';
import { FireCatcher, LaserAimStick } from './FireControls';
import { ButtonLayoutBar, EditorBar, SettingsMenu } from './HudMenus';

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
  story: string;
  sectorBanner: number;
  upgradeFlash: number;
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
  onCampaign: () => void;
  campaignUnlocked: boolean;
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
  onCampaign,
  campaignUnlocked,
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

      {playing && ui === 'none' && cue && !model.story && model.upgradeFlash <= 0 ? (
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
      {model.mode === 'playing' && model.upgradeFlash > 0 ? (
        <View pointerEvents="none" style={styles.bannerWrap}>
          <Text style={styles.kicker}>ENDLESS</Text>
          <Text style={styles.bannerTitle}>WEAPONS UPGRADE</Text>
        </View>
      ) : null}
      {model.mode === 'playing' && model.upgradeFlash <= 0 && (model.sectorBanner > 0.15 || model.story) ? (
        <View pointerEvents="none" style={styles.bannerWrap}>
          <Text style={styles.kicker}>{model.story ? model.sectorName.toUpperCase() : `WAVE ${model.wave}`}</Text>
          <Text style={[styles.bannerTitle, model.story ? { fontSize: 18, letterSpacing: 0, lineHeight: 24 } : null]}>
            {model.story || model.sectorName.toUpperCase()}
          </Text>
        </View>
      ) : null}
      {model.mode === 'ready' && ui === 'none' ? (
        <MainMenu
          onPlay={onPlay}
          onCampaign={onCampaign}
          campaignUnlocked={campaignUnlocked}
          onShips={onOpenShips}
          onScores={onOpenScores}
          onSettings={onOpenSettings}
          onPrivacy={onOpenPrivacy}
        />
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

function formatScore(value: number): string {
  return Math.max(0, Math.floor(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

