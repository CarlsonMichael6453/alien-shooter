import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { APP_VERSION, FEEDBACK_EMAIL } from '../config';
import { buildMailto, type FeedbackKind } from '../feedback/mailto';

function markUi(node: unknown): void {
  const element = node as { setAttribute?: (name: string, value: string) => void } | null;
  element?.setAttribute?.('data-alien-ui', '1');
}

function deviceLine(): string {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const match = navigator.userAgent.match(/\(([^)]+)\)/);
    const inside = match?.[1]
      ?.split(';')
      .slice(0, 2)
      .join(';')
      .replace(/\s+like\s+.*/i, '')
      .trim();
    return inside || 'web';
  }
  const constants = Platform.constants as { Model?: string; Brand?: string; systemName?: string } | undefined;
  return constants?.Model || constants?.systemName || constants?.Brand || Platform.OS;
}

export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const window = useWindowDimensions();
  const [kind, setKind] = useState<FeedbackKind>('feedback');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const screen = `${Math.round(window.width)}×${Math.round(window.height)}`;
  const platform = Platform.OS;
  const device = useMemo(() => deviceLine(), []);
  const ready = FEEDBACK_EMAIL.trim().length > 0;

  const send = () => {
    const url = buildMailto(FEEDBACK_EMAIL, {
      kind,
      rating,
      message,
      email,
      version: APP_VERSION,
      platform,
      device,
      screen,
    });
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={styles.scrim}>
      <View style={styles.card}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>{kind === 'bug' ? 'BUG' : 'NOTE'}</Text>
          <Text style={styles.title}>{kind === 'bug' ? 'Report a bug' : 'Feedback'}</Text>
          <View style={styles.kinds}>
            <Pressable accessibilityRole="button" onPress={() => setKind('feedback')} style={[styles.kind, kind === 'feedback' ? styles.kindOn : null]}>
              <Text style={[styles.kindText, kind === 'feedback' ? styles.kindTextOn : null]}>Feedback</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setKind('bug')} style={[styles.kind, kind === 'bug' ? styles.kindOn : null]}>
              <Text style={[styles.kindText, kind === 'bug' ? styles.kindTextOn : null]}>Report a bug</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Rating</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                onPress={() => setRating(value)}
                style={styles.star}
              >
                <Text style={[styles.starGlyph, rating != null && value <= rating ? styles.starOn : null]}>★</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{kind === 'bug' ? 'What went wrong?' : 'Message'}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={kind === 'bug' ? 'What happened?' : 'What should we know?'}
            placeholderTextColor="#6E8298"
            multiline
            style={[styles.input, styles.message]}
          />
          <Text style={styles.label}>Email, if you want a reply</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="optional"
            placeholderTextColor="#6E8298"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          <View style={styles.meta}>
            <Text style={styles.metaLine}>Version {APP_VERSION}</Text>
            <Text style={styles.metaLine}>Platform {platform}</Text>
            <Text style={styles.metaLine}>Device {device}</Text>
            <Text style={styles.metaLine}>Screen {screen}</Text>
          </View>
          {ready ? (
            <Pressable accessibilityRole="button" onPress={send} style={styles.primary}>
              <Text style={styles.primaryText}>Send</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>Feedback isn't set up yet.</Text>
          )}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

export function RatingPrompt({
  score,
  onRate,
  onLater,
  onNever,
}: {
  score: number;
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
}) {
  return (
    <View ref={markUi} collapsable={false} pointerEvents="auto" style={styles.scrim}>
      <View style={styles.prompt}>
        <Text style={styles.kicker}>NEW HIGH SCORE</Text>
        <Text style={styles.score}>{Math.max(0, Math.floor(score)).toString()}</Text>
        <Text style={styles.promptBody}>If you're enjoying the game, a rating helps. You can skip this.</Text>
        <Pressable accessibilityRole="button" onPress={onRate} style={styles.primary}>
          <Text style={styles.primaryText}>Rate it</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onLater} style={styles.secondary}>
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNever} style={styles.quiet}>
          <Text style={styles.quietText}>Don't ask again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const font = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif-condensed',
  default: 'system-ui, sans-serif',
});

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 6, 14, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    backgroundColor: 'rgba(7, 12, 26, 0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.28)',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  prompt: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0B1220',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.28)',
    paddingHorizontal: 22,
    paddingVertical: 24,
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
    fontSize: 30,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 12,
  },
  score: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 42,
    fontWeight: '800',
    marginTop: 4,
  },
  promptBody: {
    color: '#D5E2F2',
    fontFamily: font,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 8,
  },
  kinds: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kind: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.35)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  kindOn: {
    backgroundColor: '#7EF0FF',
    borderColor: '#7EF0FF',
  },
  kindText: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 14,
    fontWeight: '700',
  },
  kindTextOn: {
    color: '#071018',
  },
  label: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlyph: {
    color: '#5C7086',
    fontSize: 28,
  },
  starOn: {
    color: '#FFD56A',
  },
  input: {
    color: '#F4FBFF',
    fontFamily: font,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(3, 6, 14, 0.65)',
  },
  message: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  meta: {
    marginTop: 12,
    gap: 2,
  },
  metaLine: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    marginTop: 14,
    color: '#D5E2F2',
    fontFamily: font,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  primary: {
    marginTop: 14,
    backgroundColor: '#7EF0FF',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#071018',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '800',
  },
  secondary: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(126, 240, 255, 0.4)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#E7F7FF',
    fontFamily: font,
    fontSize: 15,
    fontWeight: '700',
  },
  quiet: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quietText: {
    color: '#9BB0C9',
    fontFamily: font,
    fontSize: 13,
    fontWeight: '700',
  },
});
