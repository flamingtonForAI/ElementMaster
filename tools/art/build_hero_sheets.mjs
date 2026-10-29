import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng, blitFrame } from '../readability.mjs';
const { PC } = await import('../../src/art/painter.ts');
const out = new URL('../../public/assets/heroes/', import.meta.url);
mkdirSync(out, { recursive: true });
const ids = ['xiao','zhu','ruan','qingdai','moheng','xuanyi'];
const sizes = [48];
const captured = [];
const originals = {};
const methods = ['set','rect','span','ellipse','circle','line','strand','tri','selectiveOutline','outline','under','underRing'];
// Record only top-level native drawing operations, preserving the original pose coordinates.
for (const method of methods) {
  originals[method] = PC.prototype[method];
  PC.prototype[method] = function(...args) {
    if (!this._depth) (this._commands ??= []).push({method,args,ox:this.ox,oy:this.oy});
    this._depth = (this._depth ?? 0) + 1;
    try { return originals[method].apply(this,args); } finally { this._depth--; }
  };
}
const originalBlit = PC.prototype.blit;
PC.prototype.blit = function(...args) { captured.push(this); return originalBlit.apply(this,args); };
const animations = [];
const scene = { textures:{addCanvas(){return {add(){}};}},anims:{create(a){animations.push(a);}} };
const heroes = {};
for (const id of ids) {
  captured.length = 0;
  const title = id[0].toUpperCase()+id.slice(1);
  const module = await import(`../../src/art/hero${title}.ts`);
  module[`buildHero${title}`](scene);
  heroes[id] = captured.slice();
}
for (const method of methods) PC.prototype[method] = originals[method];
PC.prototype.blit = originalBlit;

// Re-rasterize the original drawing operations on a 48px grid; retain pose timing and palette.
function replay(source,size) {
  if (size===32) return source;
  const p=new PC(size,size), k=size/32;
  for (const {method:m,args:a,ox,oy} of source._commands) {
    const cell=(x,y,w,h,c,alpha=255)=>{
      const x0=Math.round(Math.round(x+ox)*k),y0=Math.round(Math.round(y+oy)*k);
      const x1=Math.round((Math.round(x+ox)+w)*k),y1=Math.round((Math.round(y+oy)+h)*k);
      p.rect(x0,y0,x1-x0,y1-y0,c,alpha);
    };
    const xy=(x,y)=>[(x+ox+.5)*k-.5,(y+oy+.5)*k-.5];
    if(m==='set') cell(a[0],a[1],1,1,a[2],a[3]);
    else if(m==='rect') cell(a[0],a[1],Math.ceil(a[2]),Math.ceil(a[3]),a[4],a[5]);
    else if(m==='span') cell(Math.round(a[1]),a[0],Math.round(a[2])-Math.round(a[1])+1,1,a[3],a[4]);
    else if(m==='ellipse') p.ellipse((a[0]+ox)*k,(a[1]+oy)*k,a[2]*k,a[3]*k,a[4]);
    else if(m==='circle') p.circle((a[0]+ox)*k,(a[1]+oy)*k,a[2]*k,a[3]);
    else if(m==='line') p.line(...xy(a[0],a[1]),...xy(a[2],a[3]),a[4],Math.max(1,Math.round((a[5]??1)*k)),a[6]);
    else if(m==='strand') p.strand(a[0].map(([x,y])=>xy(x,y)),a[1],Math.max(1,Math.round((a[2]??2)*k)));
    else if(m==='tri') p.tri(...a.slice(0,3).map(([x,y])=>[(x+ox)*k,(y+oy)*k]),a[3]);
    else if(m==='under'||m==='underRing') p[m](a[0]*k,a[1]*k,a[2]*k,a[3]*k,a[4],a[5]);
    else if(m==='selectiveOutline'||m==='outline') p[m](...a); // one pixel on the new grid
    else throw new Error(m);
  }
  return p;
}
function rgba(p) {
 const data=new Uint8ClampedArray(p.w*p.h*4);
 for(let i=0;i<p.c.length;i++) if(p.c[i]>=0) data.set([(p.c[i]>>16)&255,(p.c[i]>>8)&255,p.c[i]&255,p.a[i]],i*4);
 return {w:p.w,h:p.h,data};
}
function stats(p) {
 let x0=p.w,y0=p.h,x1=-1,y1=-1,n=0;const colors=new Set();
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){let i=y*p.w+x;if(p.a[i]===255){n++;colors.add(p.c[i]);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 return {opaquePixels:n,colors:colors.size,bounds:[x0,y0,x1+1,y1+1]};
}
const report={kind:'native drawing command rerasterization study; not final manual pixel refinement',sizes,frames:0,animations:animations.length,heroes:{}};
for(const id of ids){
 report.heroes[id]={};
 for(const size of sizes){
  const frames=heroes[id].map(p=>replay(p,size));
  const data=new Uint8ClampedArray(28*size*5*size*4);
  frames.forEach((p,i)=>blitFrame(data,28*size,5*size,rgba(p),(i%28)*size,Math.floor(i/28)*size));
  writeFileSync(new URL(`${id}-${size}.png`,out),encodePng(28*size,5*size,data));
  if(frames.length!==140||frames.some(p=>!p.a.some(a=>a===255)))throw new Error(id);
  report.frames+=frames.length;
  report.heroes[id][size]=stats(frames[0]);
 }
}
writeFileSync(new URL('../../src/art/heroAnimations.json', import.meta.url),'[\n'+animations.map(a=>'  '+JSON.stringify(a)).join(',\n')+'\n]\n');
console.log(JSON.stringify({frames:report.frames,animations:report.animations,sizes}));
