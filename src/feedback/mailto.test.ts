import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMailto, feedbackBody, type FeedbackDraft } from './mailto';

const draft = (overrides: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
  kind: 'feedback',
  rating: 4,
  message: 'The saucers feel fair.',
  email: 'pilot@example.com',
  version: '1.0.0',
  platform: 'web',
  device: 'iPhone; CPU iPhone OS 17_0',
  screen: '390×844',
  ...overrides,
});

describe('feedback mailto', () => {
  it('refuses to build a link when the address is empty', () => {
    assert.equal(buildMailto('', draft()), null);
    assert.equal(buildMailto('   ', draft()), null);
    assert.equal(buildMailto('not an address', draft()), null);
  });

  it('fills a feedback message with the rating and the device details', () => {
    const url = buildMailto('player@example.com', draft());
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'mailto:');
    assert.equal(parsed.pathname, 'player@example.com');
    assert.equal(parsed.searchParams.get('subject'), 'Alien Shooter feedback');
    const body = parsed.searchParams.get('body') ?? '';
    assert.match(body, /^Feedback/);
    assert.match(body, /Rating: 4\/5/);
    assert.match(body, /The saucers feel fair\./);
    assert.match(body, /Reply-to: pilot@example.com/);
    assert.match(body, /Version: 1\.0\.0/);
    assert.match(body, /Platform: web/);
    assert.match(body, /Device: iPhone; CPU iPhone OS 17_0/);
    assert.match(body, /Screen: 390×844/);
  });

  it('switches the subject and the opening line for a bug report', () => {
    const bug = draft({ kind: 'bug', rating: null, message: '   ', email: '' });
    const url = buildMailto('player@example.com', bug);
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('subject'), 'Alien Shooter bug report');
    const body = parsed.searchParams.get('body') ?? '';
    assert.match(body, /^Bug report/);
    assert.match(body, /Rating: not given/);
    assert.match(body, /\(no message\)/);
    assert.equal(body.includes('Reply-to:'), false);
    assert.equal(feedbackBody(bug).split('\n')[0], 'Bug report');
  });
});
