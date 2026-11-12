/* Fuzz: milhares de ações aleatórias verificando invariantes. Uso: node tests/fuzz.js [seed] [temporadas] */
const SB=require('./load-engine.js')();
SB.setRandom(SB.seeded(Number(process.argv[2]||42)));
let s=SB.defaultState('Teste','Recife');
const acts=Object.keys(SB.act).filter(a=>a!=='endSeason');
let errs=0,okc={};
for(let season=0;season<Number(process.argv[3]||20);season++){
 for(let i=0;i<4000;i++){
  const a=acts[SB.rand(0,acts.length-1)];
  let args=[];
  if(a==='mission')args=[SB.MISSIONS[SB.rand(0,SB.MISSIONS.length-1)].id];
  if(a==='train')args=[SB.STATS[SB.rand(0,3)].id];
  if(a==='travel')args=[SB.DISTRICTS[SB.rand(0,4)].id];
  if(a==='bank')args=[['deposit','withdraw'][SB.rand(0,1)],SB.rand(1,3000)];
  if(['buy','sell'].includes(a))args=[SB.BUSINESSES[SB.rand(0,4)].id];
  if(['dialogue','pact','alliance','breakDeal','clash'].includes(a))args=[SB.FACTIONS[SB.rand(0,2)].id];
  if(a==='foundGang')args=['Bonde do Teste'];
  if(a==='recruit')args=[SB.ROLES[SB.rand(0,2)].id];
  if(a==='dismiss')args=[s.crew[0]?.id];
  if(a==='duel')args=[SB.RIVALS[SB.rand(0,SB.RIVALS.length-1)].id];
  if(a==='clinic')args=[['posto','clinica','x'][SB.rand(0,2)]];
  if(a==='buyItem')args=[SB.ITEMS[SB.rand(0,SB.ITEMS.length-1)].id];
  if(['buyGood','sellGood'].includes(a))args=[SB.GOODS[SB.rand(0,5)].id,SB.rand(1,30)];
  if(a==='buildLab')args=[SB.LABS[SB.rand(0,2)].id];
  if(a==='night')args=[SB.NIGHT[SB.rand(0,2)].id];
  if(a==='career')args=[SB.CAREERS[SB.rand(0,2)].id];
  if(a==='goal')args=[SB.GOALS[SB.rand(0,4)].id];
  if(a==='news')args=[s.newsPending?.id,SB.rand(0,1)];
  if(a==='nextDay'&&SB.rand(1,10)>2)continue;
  try{const r=SB.perform(s,a,...args);if(r.ok)okc[a]=(okc[a]||0)+1;}catch(e){errs++;if(errs<5)console.log('ERR',a,e.stack)}
  // invariants
  const bad=[];for(const g of SB.GOODS)if(!Number.isInteger(s.goods[g.id])||s.goods[g.id]<0)bad.push('goods');if(SB.cargoUsed(s)>SB.cargoCap(s)+0)bad.push('cargo '+SB.cargoUsed(s)+'/'+SB.cargoCap(s));
  for(const k of ['cash','bank','energy','heat','respect','jail'])if(!Number.isInteger(s[k])||s[k]<0)bad.push(k+'='+s[k]);
  if(s.energy>100||s.heat>100)bad.push('cap');if(!Number.isInteger(s.health)||s.health<0||s.health>100||s.hospital<0)bad.push('health '+s.health);
  for(const d of SB.DISTRICTS){if(s.influence[d.id]<0||s.influence[d.id]>100)bad.push('inf');for(const f of SB.FACTIONS){const p=s.presence[d.id][f.id];if(!Number.isInteger(p)||p<0||p>100)bad.push('pres '+p)}}
  if(bad.length){console.log('INVARIANT',a,bad);process.exit(1)}
  if(s.day===30){const r=SB.perform(s,'endSeason');s=r.state;break}
 }
 // roundtrip
 const p=SB.parseSave(JSON.stringify(s));if(!p.ok){console.log('roundtrip fail',p.error);process.exit(1)}
 s=p.state;
}
if(errs)process.exitCode=1;console.log('erros',errs,'season',s.season,JSON.stringify(okc));
