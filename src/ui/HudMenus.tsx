import { Pressable, Text, View } from 'react-native';
import type { AudioSettings } from '../audio/arcade';
import type { ControlScheme } from './controlsMode';
import type { Field, HudElement, HudElementId } from './hudLayout';
import { elementLabel } from './hudLayout';
import { styles } from './hudStyles';

function markUi(node: unknown): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-ui', '1');
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

export function SettingsMenu({
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

export function ButtonLayoutBar({ field, onReset, onDone }: { field: Field; onReset: () => void; onDone: () => void }) {
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

export function EditorBar({
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

export function VolumeRow({
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

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

