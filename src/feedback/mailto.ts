export type FeedbackKind = 'feedback' | 'bug';

export interface FeedbackDraft {
  kind: FeedbackKind;
  /** 1–5, or null when the player skipped the stars. */
  rating: number | null;
  message: string;
  email: string;
  version: string;
  platform: string;
  device: string;
  screen: string;
}

export function feedbackSubject(kind: FeedbackKind): string {
  return kind === 'bug' ? 'Alien Shooter bug report' : 'Alien Shooter feedback';
}

export function feedbackBody(draft: FeedbackDraft): string {
  const lines = [
    draft.kind === 'bug' ? 'Bug report' : 'Feedback',
    '',
    `Rating: ${draft.rating == null ? 'not given' : `${draft.rating}/5`}`,
    '',
    draft.message.trim() || '(no message)',
    '',
  ];
  if (draft.email.trim()) lines.push(`Reply-to: ${draft.email.trim()}`, '');
  lines.push(
    `Version: ${draft.version}`,
    `Platform: ${draft.platform}`,
    `Device: ${draft.device}`,
    `Screen: ${draft.screen}`,
  );
  return lines.join('\n');
}

/** A mailto URL, or null when no destination address is configured. */
export function buildMailto(address: string, draft: FeedbackDraft): string | null {
  const to = address.trim();
  if (!to || /[\s?]/.test(to)) return null;
  const subject = encodeURIComponent(feedbackSubject(draft.kind));
  const body = encodeURIComponent(feedbackBody(draft));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
