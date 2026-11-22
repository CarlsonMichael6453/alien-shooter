import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAudioSettings } from './arcade';

describe('audio settings', () => {
  it('starts with music and effects on', () => {
    const settings = parseAudioSettings(null);
    assert.equal(settings.musicOn, true);
    assert.equal(settings.sfxOn, true);
    assert.equal(settings.vibrate, true);
    assert.ok(settings.music > 0 && settings.music <= 1);
    assert.ok(settings.sfx > 0 && settings.sfx <= 1);
  });

  it('keeps a saved mute and clamps the volumes', () => {
    const settings = parseAudioSettings('{"music":2,"sfx":-1,"musicOn":false,"sfxOn":true}');
    assert.equal(settings.music, 1);
    assert.equal(settings.sfx, 0);
    assert.equal(settings.musicOn, false);
    assert.equal(settings.sfxOn, true);
    assert.deepEqual(parseAudioSettings('nope').musicOn, true);
  });
});
