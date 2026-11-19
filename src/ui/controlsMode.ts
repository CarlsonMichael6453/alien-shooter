import type { Kv } from './kv';

export type ControlScheme = 'joystick' | 'drag';

export const CONTROLS_KEY = 'alien-shooter:controls';

export function parseControlScheme(raw: string | null): ControlScheme {
  return raw === 'drag' ? 'drag' : 'joystick';
}

export async function loadControlScheme(store: Kv): Promise<ControlScheme> {
  return parseControlScheme(await store.getItem(CONTROLS_KEY));
}

export async function saveControlScheme(store: Kv, scheme: ControlScheme): Promise<void> {
  await store.setItem(CONTROLS_KEY, scheme);
}
