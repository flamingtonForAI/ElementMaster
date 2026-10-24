import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTIONS, decisionRequest, validateAnswer, readKey } from '../tools/playtest/protocol.mjs';

test('playtest restricts movement and upgrades to available choices, rotating order', () => {
  const state = { options: [], movement: ACTIONS.map(id => ({ id, blocked: false })) };
  const a = decisionRequest(state, 0), b = decisionRequest(state, 1);
  assert.equal(Object.keys(a.questions.action.criteria).length, 9);
  assert.equal(Object.keys(b.questions.action.criteria)[0], 'UP_RIGHT');
  assert.equal(validateAnswer({ answers: { action: { type: 'choice', choice: 'STAY' } } }, a).choice, 'STAY');
  assert.throws(() => validateAnswer({ answers: { action: { type: 'choice', choice: 'TELEPORT' } } }, a));
  const upgrade = decisionRequest({ options: [{ kind: 'heal' }, { kind: 'skill', id: 'slash', lv: 2 }] }, 1);
  assert.equal(Object.keys(upgrade.questions.action.criteria)[0], 'option_1');
  assert.deepEqual(Object.keys(upgrade.questions.action.criteria).sort(), ['option_0', 'option_1']);
  assert.throws(() => validateAnswer({ answers: { action: { type: 'choice', choice: 'option_2' } } }, upgrade));
});
test('key file parsing fails closed without echoing contents', () => {
  const key = 'test_abcdefghijklmnopqrstuvwxyz';
  assert.equal(readKey('# apikey ' + key), key);
  assert.throws(() => readKey('missing'));
  assert.throws(() => readKey(key + '\n' + key));
});

test('level-three profiles change only recovery and fit six skill/passive slots', async () => {
  const { level3Profile } = await import('../tools/playtest/profiles.mjs');
  for (const id of ['xiao', 'qingdai', 'moheng']) {
    const full = level3Profile(id, 5), low = level3Profile(id, 0);
    assert.equal(Object.keys(full.skills).length, 6);
    assert.equal(Object.keys(full.passives).length, 6);
    assert.ok(Object.values(full.skills).every(lv => lv === 8));
    assert.deepEqual({ ...full, passives: { ...full.passives, changsheng: 0 } }, low);
    assert.equal(full.meta.qixue, 5);
    assert.equal(full.meta.shenfa, 3);
    assert.equal(full.meta.xuming, undefined);
  }
  assert.throws(() => level3Profile('unknown'));
});

test('progression reference policy uses valid moves and available upgrades', async () => {
  const { scriptedAction } = await import('../tools/playtest/protocol.mjs');
  const base = {hp:20,maxHp:100,skills:[{id:'puppet',lv:1}],stats:{speed:66},enemies:[],pickups:[],slashCooldown:0.4};
  assert.equal(scriptedAction({...base,options:[{kind:'skill',id:'puppet',lv:2},{kind:'heal'}]}),'option_1');
  const facts = {minProjectileClearance:999,minEnemyClearance:999,nearestXpDistanceAfter:999,slashTargetsAfter:0,warning:false};
  assert.equal(scriptedAction({...base,options:[],movement:[{id:'UP',...facts,blocked:true},{id:'STAY',...facts,blocked:false}]}),'STAY');
});
