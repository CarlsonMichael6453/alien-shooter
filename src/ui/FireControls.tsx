import { markFireZone, markIgnoresPointer, markLaserZone } from '../web/bindControls';
import { elementBounds, FIRE_HIT_SLOP, laserStickRect, type Field, type HudLayout } from './hudLayout';
import { styles } from './hudStyles';
import { Text, View } from 'react-native';

export function LaserAimStick({
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

export function FireCatcher({ layout, field }: { layout: HudLayout; field: Field }) {
  const fire = layout.elements.find((element) => element.id === 'fire');
  if (!fire?.visible) return null;
  const bounds = elementBounds(fire, field, 1);
  const slop = FIRE_HIT_SLOP;
  return (
    <View
      ref={markFireZone}
      collapsable={false}
      pointerEvents="auto"
      accessibilityLabel="Fire button"
      style={[
        styles.fireZone,
        {
          left: bounds.x - slop,
          top: bounds.y - slop,
          width: bounds.w + slop * 2,
          height: bounds.h + slop,
        },
      ]}
    />
  );
}

