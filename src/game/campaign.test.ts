import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGame } from './logic';
import { shipUnlocked } from './ships';
import { EMPTY_ENTITLEMENTS } from './premium';
import {
  CAMPAIGN_SECTORS,
  CAMPAIGN_UNLOCK_SCORE,
  beginCampaign,
  campaignUnlocked,
  devCampaignFromLocation,
  onCampaignBossDown,
  parseCampaign,
  tickCampaign,
} from './campaign';

describe('campaign mode', () => {
  it('stays locked until the best score reaches 5000, and a dev flag opens it', () => {
    assert.equal(campaignUnlocked(4999), false);
    assert.equal(campaignUnlocked(CAMPAIGN_UNLOCK_SCORE), true);
    assert.equal(campaignUnlocked(0, true), true);
    assert.equal(devCampaignFromLocation('?unlockCampaign=1'), true);
    assert.equal(devCampaignFromLocation('?unlockAll=1'), true);
    assert.equal(devCampaignFromLocation(''), false);
  });

  it('does not unlock the premium ships', () => {
    assert.equal(shipUnlocked({ id: 'superpink', name: 'SuperPink', score: 0, wave: 1, premium: true, productId: 'ship_superpink', wing: '', hull: '', core: '', accent: '' }, 20000, 20, EMPTY_ENTITLEMENTS), false);
  });

  it('walks Pluto to the Moon and saves a cleared flag on the final mothership', () => {
    const state = createGame(390, 700);
    beginCampaign(state, 0);
    assert.equal(state.runKind, 'campaign');
    assert.equal(state.introText, CAMPAIGN_SECTORS[0].intro);
    tickCampaign(state, 3);
    assert.ok(state.boss);
    assert.equal(state.sector, 0);
    state.boss = null;
    assert.equal(onCampaignBossDown(state), false);
    assert.equal(state.campaignSector, 1);
    assert.equal(state.introText, CAMPAIGN_SECTORS[1].intro);
    state.campaignSector = 4;
    assert.equal(onCampaignBossDown(state), true);
    assert.equal(state.campaignCleared, true);
    assert.equal(state.mode, 'over');
    assert.deepEqual(parseCampaign('{"sector":4,"cleared":true}'), { sector: 4, cleared: true });
    assert.equal(parseCampaign('nope').sector, 0);
  });
});
