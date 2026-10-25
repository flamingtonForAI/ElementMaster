import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
test('后期试玩观测包含真实地形、落点预警和实际经验回收，支持十五分钟关卡',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const level of [6,7,8,9,10]) {
   const context=await browser.newContext(),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${process.env.PLAYTEST_URL||'http://127.0.0.1:5180/'}?level=${level}&char=ruan&hd=0&playtest`);
   await page.waitForFunction(()=>window.game?.scene.getScene('game')?.player);
   const r=await page.evaluate(async level=>{
    const b=(await import('/tools/playtest/bridge.js')).install(20261025,{level,character:'ruan'}),g=window.game.scene.getScene('game');
    const initial=b.snapshot();
    if(initial.options.length)b.choose(0);
    g.pickups.gem(g.player.x,g.player.y,1);
    b.advance('STAY',30);
    const collected=b.snapshot();
    g.fx.telegraph(g.player.x,g.player.y,30,0xff0000,1);
    g.hazards.miasmaAt(g.player.x,g.player.y,80,1,10);
    g.hazards.patch(g.player.x,g.player.y,30,10,1);
    const hazards=b.snapshot();
    return {initial,collected,hazards};
   },level);
   assert.equal(r.initial.level,1);assert.equal(r.initial.skills.length,1);assert.equal(r.initial.time,0);
   assert.equal(r.initial.levelId,level);assert.ok(r.initial.terrain.name);assert.ok(r.initial.terrain.lesson);
   assert.equal(r.initial.duration,level===6?600:level===10?900:720);
   assert.equal(r.collected.metrics.xpDropped,1);assert.equal(r.collected.metrics.xpCollected,1);assert.equal(r.collected.xpOnGround,0);
   assert.ok(r.hazards.movement.every(m=>m.warning));
   assert.ok(r.hazards.terrain.ground.includes('poison_fog'));
   assert.ok(r.hazards.terrain.ground.includes('fire_damage'));
   assert.deepEqual(errors,[]);
   await context.close();
  }
 } finally {await browser.close();}
});
