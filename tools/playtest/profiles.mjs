export function level3Profile(character, regenLevel = 5) {
  const start = { xiao: 'slash', qingdai: 'duwu', moheng: 'puppet' }[character];
  if (!start || ![0, 5].includes(regenLevel)) throw Error('Unsupported level-three comparison');
  return { level: 3, character, buildLevel: 25, lockXp: true,
    meta: { qixue: 5, huti: 3, huichun: 3, shenfa: 3, shouling: 2, wuxing: 5 },
    skills: Object.fromEntries([start, 'flysword', 'leaf', 'waterdragon', 'stonespike', 'jinzhen'].map(id => [id, 8])),
    passives: { houtu: 5, qingshen: 5, changsheng: regenLevel, ningshen: 5, roushui: 5, yanyang: 5 } };
}
