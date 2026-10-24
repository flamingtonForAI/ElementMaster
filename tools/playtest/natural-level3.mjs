import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const character=process.argv[2];
const campaign=JSON.parse(readFileSync(`output/playtest/growth-${character}-campaign.json`,'utf8'));
if(!campaign.complete)throw Error('Campaign did not unlock level 3');
const policy=process.argv.includes('--script')?'script':'jev';
const requestedSeed=Number(process.argv[3]);
const seeds=policy==='script'?[20261022]:Number.isInteger(requestedSeed)?[requestedSeed]:[20261022,20261023,20261024];
if(seeds.some(s=>![20261022,20261023,20261024].includes(s)))throw Error('Unsupported natural test seed');
for(const seed of seeds) {
 const out=resolve(`output/playtest/natural3-${character}-${policy}-${seed}`);
 if(existsSync(`${out}/result.json`))continue;
 const env={...process.env,PLAYTEST_PROFILE:'progression',PLAYTEST_CHARACTER:character,
  PLAYTEST_LEVEL:'3',PLAYTEST_SAVE_FILE:campaign.saveFile,PLAYTEST_POLICY:policy,
  PLAYTEST_SEED:String(seed),PLAYTEST_VARIANT:'normal-growth-floor25',PLAYTEST_OUT:out};
 execFileSync(process.execPath,['tools/playtest/run.mjs'],{env,stdio:'inherit'});
}
