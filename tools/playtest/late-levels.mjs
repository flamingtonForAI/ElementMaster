import {spawn} from 'node:child_process';
import {createWriteStream,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]??'');
const seed=Number(process.argv[3]??20261025);
const levels=process.argv.slice(4).map(Number);
if(!levels.length)levels.push(6,7,8,9,10);
if(!existsSync(`${root}/baseline-save.json`)||!Number.isSafeInteger(seed)||levels.some(l=>!Number.isInteger(l)||l<1||l>10))throw Error('Usage: late-levels.mjs <root with baseline-save.json> <seed> [levels 1..10; default 6..10]');
const pending=[...levels], results=[];
async function worker(){
 while(pending.length){
  const level=pending.shift(),out=`${root}/l${level}-s${seed}`;
  if(existsSync(out))throw Error(`Refusing to overwrite ${out}`);
  const log=createWriteStream(`${out}.log`);
  console.log(JSON.stringify({started:{level,seed},out}));
  const child=spawn(process.execPath,['tools/playtest/run.mjs'],{env:{...process.env,
   PLAYTEST_PROFILE:'progression',PLAYTEST_CHARACTER:'ruan',PLAYTEST_LEVEL:String(level),PLAYTEST_SPEND:'0',
   PLAYTEST_SAVE_FILE:`${root}/baseline-save.json`,PLAYTEST_POLICY:'jev',PLAYTEST_SEED:String(seed),
   PLAYTEST_VARIANT:process.env.PLAYTEST_VARIANT??'late-role-and-spawn-balance',PLAYTEST_OUT:out},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  log.end();
  const resultFile=`${out}/result.json`;
  const result=existsSync(resultFile)?JSON.parse(readFileSync(resultFile,'utf8')):null;
  const row={level,seed,code,out,completed:result?.completed??false,result:result?.result??null,calls:result?.calls??null};
  results.push(row);writeFileSync(`${root}/batch-${seed}-${levels.join('-')}.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify({finished:row}));
 }
}
await Promise.all(Array.from({length:Math.min(3,levels.length)},worker));
if(results.some(r=>!r.completed))process.exitCode=1;
