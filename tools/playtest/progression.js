import { UPGRADES, price } from '../../src/config/meta.ts';
import { CHARACTERS } from '../../src/config/characters.ts';
import { STAR, canLight, litSet } from '../../src/config/startree.ts';
import { LEGACIES } from '../../src/config/legacy.ts';
import { daoPoints, legacyPoints, treeStart } from '../../src/game/talents.ts';

// Use only points and currency actually present in this isolated save.
export function spendProgression(save, character) {
  const c = CHARACTERS.find(c => c.id === character);
  if (!c) throw Error('Unknown character');
  const ledger = [];
  const priorities = ['huti', 'qixue', 'shenfa', 'huichun', 'shouling'];
  while (true) {
    const choices = priorities.map(id => UPGRADES.find(d => d.id === id))
      .filter(d => (save.meta[d.id] ?? 0) < d.maxLv && price(d, save.meta) <= save.lingshi)
      .sort((a,b) => (save.meta[a.id] ?? 0) - (save.meta[b.id] ?? 0) || priorities.indexOf(a.id)-priorities.indexOf(b.id));
    const d = choices[0];
    if (!d) break;
    const cost = price(d, save.meta);
    save.lingshi -= cost; save.spent += cost;
    save.meta[d.id] = (save.meta[d.id] ?? 0) + 1;
    ledger.push({ kind: 'purchase', id: d.id, level: save.meta[d.id], cost, remaining: save.lingshi });
  }
  const nodes = save.tree[c.id] ??= [];
  const start = treeStart(c);
  while (nodes.length < daoPoints(save,c)) {
    const lit = litSet(start, nodes);
    const score = n => (n.el === c.el ? 20 : 0) + (n.mods.armor ?? 0)*5 + (n.mods.hp ?? 0)*20 + (n.mods.regen ?? 0)*5;
    const next = Object.values(STAR).filter(n => canLight(n.id,start,lit)).sort((a,b)=>score(b)-score(a) || a.id.localeCompare(b.id))[0];
    if (!next) break;
    nodes.push(next.id); ledger.push({kind:'star', id:next.id, name:next.name, mods:next.mods});
  }
  const owned = save.legacy[c.id] ??= [];
  const branches = LEGACIES[c.id] ?? [];
  const branchOrder = c.id === 'qingdai' ? branches : [...branches].reverse();
  for (const branch of branchOrder) for (const node of branch.nodes) {
    if (owned.length >= legacyPoints(save,c)) break;
    if (!owned.includes(node.id)) { owned.push(node.id); ledger.push({kind:'legacy',id:node.id,name:node.name,mods:node.mods}); }
  }
  return ledger;
}
