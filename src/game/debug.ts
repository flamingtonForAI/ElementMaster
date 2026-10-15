import { Pane } from 'tweakpane';
import { REL_MULT } from '../config/elements';
import { DIFF } from '../config/levels';
import type { GameScene } from '../scenes/GameScene';

export function debugEnabled() {
  return import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
}

/** 调试面板，按 ` 键显示/隐藏 */
export function createDebug(g: GameScene) {
  const pane = new Pane({ title: '调试 (` 切换)' });
  pane.element.parentElement!.style.zIndex = '10';
  pane.hidden = true;
  const f1 = pane.addFolder({ title: '局内' });
  f1.addBinding(g.dbg, 'god', { label: '无敌' });
  f1.addBinding(g.dbg, 'timeScale', { label: '时间倍速', min: 0.25, max: 4, step: 0.25 });
  f1.addBinding(g.dbg, 'spawnMult', { label: '刷怪倍率', min: 0, max: 5, step: 0.1 });
  f1.addButton({ title: '升 1 级' }).on('click', () => g.gainXp(g.build.xpNeeded() - g.build.xp));
  f1.addButton({ title: '时间 +60 秒' }).on('click', () => (g.elapsed += 60));
  f1.addButton({ title: '刷精英' }).on('click', () => g.spawnElite());
  f1.addButton({ title: '刷 Boss' }).on('click', () => g.spawnBoss());
  f1.addButton({ title: '清屏' }).on('click', () => g.enemies.list.filter((e) => !e.boss).forEach((e) => g.enemies.kill(e)));
  const f2 = pane.addFolder({ title: '五行倍率', expanded: false });
  for (const k of Object.keys(REL_MULT) as (keyof typeof REL_MULT)[]) f2.addBinding(REL_MULT, k, { min: 0, max: 3, step: 0.05 });
  const f3 = pane.addFolder({ title: '难度曲线', expanded: false });
  f3.addBinding(DIFF, 'hpLin', { label: '生命·线性', min: 0, max: 1, step: 0.01 });
  f3.addBinding(DIFF, 'hpQuad', { label: '生命·平方', min: 0, max: 0.2, step: 0.005 });
  f3.addBinding(DIFF, 'dmgLin', { label: '伤害·线性', min: 0, max: 0.5, step: 0.01 });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === '`') pane.hidden = !pane.hidden;
  };
  addEventListener('keydown', onKey);
  return () => {
    removeEventListener('keydown', onKey);
    pane.dispose();
  };
}
