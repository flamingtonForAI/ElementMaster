export const MODEL = 'jev-1.13.0';
export const ACTIONS = ['UP', 'UP_RIGHT', 'RIGHT', 'DOWN_RIGHT', 'DOWN', 'DOWN_LEFT', 'LEFT', 'UP_LEFT', 'STAY'];

export function decisionRequest(snapshot, index) {
  const upgrading = snapshot.options.length > 0;
  const keys = upgrading ? snapshot.options.map((_, i) => `option_${i}`) : ACTIONS;
  // Rotate option order to avoid always favoring the first listed direction/card.
  const offset = index % keys.length;
  const ordered = [...keys.slice(offset), ...keys.slice(0, offset)];
  return {
    model: MODEL,
    state: snapshot,
    questions: { action: { type: 'choice',
      instructions: upgrading
        ? 'Choose the offered upgrade that best helps this character survive and kill the boss in THIS run. Consider current HP, skill synergy and actual stat changes. Currency has no combat benefit. Return the option index.'
        : 'Choose the next 0.5 seconds of movement for this character in a survival game; follow characterTrait and owned skills. Survive, actively kill enemies, collect XP to grow, and defeat the boss. Auto-attacks run automatically. Only if the slash skill is owned: while moving the sword attacks in the movement direction; standing still automatically aims at nearby enemies. Other skills auto-target or attack around the player; summons can take enemy aggro. STAY can be useful when slashCooldown is near zero and enemies are in range. Avoid contact, explosions, charge paths, projectiles and blocked routes. Do not flee endlessly and miss XP. Movement entries contain code-computed geometric facts; minEnemyClearance includes the starting point and assumes enemies static, so also consider their speed, behavior and dash direction. A warning is a conservative overlap, not guaranteed damage. Enemies use positions at their feet; the player hit point is y minus 6. Up is negative y.',
      criteria: Object.fromEntries(ordered.map(key => [key, upgrading ? snapshot.options[Number(key.slice(7))] :
        { direction: key, facts: snapshot.movement.find(o => o.id === key) }])) } },
  };
}

export function validateAnswer(response, request) {
  const answer = response?.answers?.action;
  if (answer?.type !== 'choice' || !Object.hasOwn(request.questions.action.criteria, answer.choice)) throw Error('Invalid Jev choice');
  return answer;
}

export function readKey(text) {
  const candidates = text.match(/[A-Za-z0-9_-]{24,}/g) ?? [];
  if (candidates.length !== 1) throw Error('Expected exactly one API key in the key file');
  return candidates[0];
}

export function scriptedAction(s) {
  if (s.options.length) {
    const score = o => {
      if (o.kind === 'heal') return s.hp / s.maxHp < 0.45 ? 100 : 0;
      if (o.kind === 'lingshi') return -10;
      if (o.kind === 'passive') return ({ changsheng: s.hp < s.maxHp*0.75 ? 21 : 10, houtu: 15,
        qingshen: 10, ningshen: 12, yanyang: 9, ruijin: 7, roushui: 7, juling: 6 })[o.id] ?? 3;
      const own = s.skills.some(k => k.id === o.id);
      const exclusive = ['slash','duwu','puppet'].includes(o.id);
      return (exclusive ? 22 : ({flysword:17,waterdragon:14,luoshi:13,lihuo:12,jinzhen:12,leaf:10,stonespike:11,fireball:11,hanbing:13})[o.id] ?? 8)
        + (own ? 1 : 3) + (o.id === 'puppet' && [2,4,8].includes(o.lv) ? 8 : 0);
    };
    return `option_${s.options.map((o,i)=>({i,score:score(o)})).sort((a,b)=>b.score-a.score)[0].i}`;
  }
  const vectors = {UP:[0,-1],UP_RIGHT:[1,-1],RIGHT:[1,0],DOWN_RIGHT:[1,1],DOWN:[0,1],DOWN_LEFT:[-1,1],LEFT:[-1,0],UP_LEFT:[-1,-1],STAY:[0,0]};
  const slash = s.skills.some(k=>k.id==='slash');
  const score = m => {
    const v=vectors[m.id], len=Math.hypot(...v)||1;
    const dx=v[0]/len*s.stats.speed*0.5, dy=v[1]/len*s.stats.speed*0.5;
    const endDist=s.enemies.reduce((best,e)=>Math.min(best,Math.hypot(e.dx-dx,e.dy-dy)-e.radius-7),999);
    let value = (m.blocked ? -10000 : 0) + (m.warning ? -1500 : 0)
      - Math.max(0,12-m.minProjectileClearance)*70 - Math.max(0,-m.minEnemyClearance)*50
      - Math.max(0,16-endDist)*55;
    value += Math.min(70,endDist)*0.2;
    if (m.nearestXpDistanceAfter < 999) value -= Math.min(180,m.nearestXpDistanceAfter)*0.35;
    if (slash) value += m.slashTargetsAfter * (s.slashCooldown < 0.5 ? 9 : 2);
    if (!s.enemies.length && !s.pickups.length && m.id==='STAY') value += 30;
    for(const p of s.pickups.filter(p=>p.kind==='heal' && s.hp<s.maxHp*0.7 || p.kind.includes('chest')))
      value += Math.max(0,120-Math.hypot(p.dx-dx,p.dy-dy))*0.3;
    return value;
  };
  return s.movement.map(m=>({id:m.id,score:score(m)})).sort((a,b)=>b.score-a.score)[0].id;
}
