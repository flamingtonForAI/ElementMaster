import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const character = process.argv[2];
if (!['xiao','qingdai','moheng'].includes(character)) throw Error('Expected tested character');
const root = resolve('output/playtest');
let saveFile = null;
const runs=[];
for (const level of [1,2]) {
  let cleared=false;
  for(let attempt=1;attempt<=4;attempt++) {
    const name=`growth-${character}-l${level}-attempt${attempt}`;
    const out=resolve(root,name);
    if (!existsSync(`${out}/result.json`)) {
      const env={...process.env,PLAYTEST_PROFILE:'progression',PLAYTEST_CHARACTER:character,
        PLAYTEST_LEVEL:String(level),PLAYTEST_POLICY:'script',PLAYTEST_VARIANT:'normal-growth-floor25',
        PLAYTEST_SEED:String(20261022+level*100+attempt),PLAYTEST_OUT:out};
      if(saveFile) env.PLAYTEST_SAVE_FILE=saveFile; else delete env.PLAYTEST_SAVE_FILE;
      execFileSync(process.execPath,['tools/playtest/run.mjs'],{env,stdio:'inherit'});
    }
    const result=JSON.parse(readFileSync(`${out}/result.json`,'utf8'));
    if(!result.completed)throw Error('Incomplete campaign run');
    saveFile=`${out}/save.json`;
    runs.push({folder:name,level,attempt,result:result.result});
    if(result.result.win) {cleared=true;break;}
  }
  if(!cleared) {
    writeFileSync(`${root}/growth-${character}-campaign.json`,JSON.stringify({character,complete:false,runs,saveFile},null,2));
    throw Error(`${character} did not clear level ${level} in four attempts; no rewards granted`);
  }
}
const save=JSON.parse(readFileSync(saveFile,'utf8'));
if(save.unlocked<3 || ![1,2].every(l=>save.clears[character]?.includes(l)))throw Error('Missing actual clears');
writeFileSync(`${root}/growth-${character}-campaign.json`,JSON.stringify({character,complete:true,runs,saveFile,save},null,2));
console.log(JSON.stringify({campaignComplete:true,character,attempts:runs.length,saveFile,meta:save.meta,lingshi:save.lingshi}));
