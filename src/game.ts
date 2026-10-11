export type Resource = 'wood'|'brick'|'wheat'|'wool'|'ore';
export type Terrain = Resource|'desert';
export type PlayerKind = 'human'|'ai';
export interface Player { id:number; name:string; kind:PlayerKind; color:string; resources:Record<Resource,number>; settlements:Set<string>; cities:Set<string>; roads:Set<string>; knights:number; points:number; }
export interface Tile { id:string; q:number; r:number; terrain:Terrain; number:number|null; vertices:string[]; }
export interface Vertex { id:string; x:number; z:number; tiles:string[]; edges:string[]; }
export interface Edge { id:string; a:string; b:string; x:number; z:number; }
export type PortType = Resource|'any';
// A harbor sits on one coastal edge; both end vertices (a,b) grant its trade rate. (nx,nz) is the outward (sea-facing) unit normal.
export interface Port { id:string; type:PortType; edge:string; a:string; b:string; x:number; z:number; nx:number; nz:number; }
export interface Board { tiles:Tile[]; vertices:Map<string,Vertex>; edges:Map<string,Edge>; ports:Port[]; }
export type Phase='setup-settlement'|'setup-road'|'roll'|'discard'|'robber'|'main'|'over';
export interface GameState { board:Board; players:Player[]; currentPlayer:number; phase:Phase; setupOrder:number[]; setupIndex:number; pendingVertex:string|null; robberTile:string; dice:[number,number]|null; winner:number|null; log:string[]; message:string; alerts:string[]; }
export const RESOURCE_INFO:Record<Resource,{label:string;icon:string;color:string}>={wood:{label:'木材',icon:'🪵',color:'#47865b'},brick:{label:'磚頭',icon:'🧱',color:'#c96f55'},wheat:{label:'小麥',icon:'🌾',color:'#e5bd4f'},wool:{label:'羊毛',icon:'🐑',color:'#8dbb83'},ore:{label:'鐵礦',icon:'⛰️',color:'#8998a8'}};
const terrains:Terrain[]=['wood','wood','wood','wood','brick','brick','brick','wheat','wheat','wheat','wheat','wool','wool','wool','wool','ore','ore','ore','desert'];
const numbers=[5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
const axial:(q:number,r:number)=>boolean=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2;
// Round first so tiny float errors (e.g. -1e-16) never produce "-0.000" and split one corner into duplicates.
const norm=(n:number)=>{const v=Math.round(n*1000)/1000;return (v===0?0:v).toFixed(3);};
const key=(x:number,z:number)=>`${norm(x)},${norm(z)}`;
const edgeKey=(a:string,b:string)=>[a,b].sort().join('|');
export function makeBoard():Board {
  const coords:{q:number;r:number}[]=[];
  for(let r=-2;r<=2;r++) for(let q=-2;q<=2;q++) if(axial(q,r)) coords.push({q,r});
  const shuffle=<T,>(arr:T[])=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  
  let valid=false; let tiles:Tile[]=[];
  while(!valid){
    const ts=shuffle([...terrains]); const ns=shuffle([...numbers]);
    tiles=coords.map(({q,r},i)=>({id:`t${q}_${r}`,q,r,terrain:ts[i],number:ts[i]==='desert'?null:ns.pop()??null,vertices:[]}));
    valid=true;
    for(let i=0;i<tiles.length&&valid;i++){
      if(tiles[i].number!==6&&tiles[i].number!==8)continue;
      for(let j=i+1;j<tiles.length&&valid;j++){
        if(tiles[j].number!==6&&tiles[j].number!==8)continue;
        const dq=tiles[i].q-tiles[j].q, dr=tiles[i].r-tiles[j].r;
        if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))===1)valid=false;
      }
    }
    if(valid){
      const visited=new Set<string>();
      for(const t of tiles){
        if(t.terrain==='desert'||visited.has(t.id))continue;
        let count=0; const q=[t]; visited.add(t.id);
        while(q.length>0){
          const curr=q.shift()!; count++;
          for(const n of tiles){
            if(n.terrain===curr.terrain&&!visited.has(n.id)){
              const dq=curr.q-n.q, dr=curr.r-n.r;
              if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))===1){visited.add(n.id);q.push(n);}
            }
          }
        }
        if(count>=3){valid=false;break;}
      }
    }
  }

  const vertices=new Map<string,Vertex>(); const edges=new Map<string,Edge>();
  for(const tile of tiles){
    const cx=Math.sqrt(3)*(tile.q+tile.r/2), cz=1.5*tile.r;
    for(let c=0;c<6;c++){
      const angle=(30+c*60)*Math.PI/180; const x=cx+Math.cos(angle), z=cz+Math.sin(angle); const id=key(x,z); tile.vertices.push(id);
      if(!vertices.has(id)) vertices.set(id,{id,x,z,tiles:[],edges:[]}); vertices.get(id)!.tiles.push(tile.id);
    }
  }
  for(const tile of tiles){for(let i=0;i<6;i++){const a=tile.vertices[i],b=tile.vertices[(i+1)%6],id=edgeKey(a,b);if(!edges.has(id)){const va=vertices.get(a)!,vb=vertices.get(b)!;edges.set(id,{id,a,b,x:(va.x+vb.x)/2,z:(va.z+vb.z)/2});va.edges.push(id);vb.edges.push(id);}}}
  return {tiles,vertices,edges,ports:makePorts(tiles,edges,shuffle)};
}
// Coastal edges belong to exactly one tile. Walking them by angle gives the 30-edge coastline; picking every
// 3/4/3... edge places 9 harbors evenly with at least two free edges between them, so no harbor vertices touch.
function makePorts(tiles:Tile[],edges:Map<string,Edge>,shuffle:<T>(a:T[])=>T[]):Port[]{
  const owner=new Map<string,Tile>();const count=new Map<string,number>();
  for(const t of tiles)for(let i=0;i<6;i++){const id=edgeKey(t.vertices[i],t.vertices[(i+1)%6]);count.set(id,(count.get(id)??0)+1);owner.set(id,t);}
  const coast=[...edges.values()].filter(e=>count.get(e.id)===1).sort((p,q)=>Math.atan2(p.z,p.x)-Math.atan2(q.z,q.x));
  const types=shuffle<PortType>(['any','any','any','any','wood','brick','wheat','wool','ore']);
  const offset=Math.floor(Math.random()*coast.length);
  return types.map((type,i)=>{const e=coast[(offset+Math.round(i*coast.length/types.length))%coast.length];const t=owner.get(e.id)!;
    const cx=Math.sqrt(3)*(t.q+t.r/2),cz=1.5*t.r;const dx=e.x-cx,dz=e.z-cz,len=Math.hypot(dx,dz)||1;
    return {id:`port${i}`,type,edge:e.id,a:e.a,b:e.b,x:e.x,z:e.z,nx:dx/len,nz:dz/len};});
}
/** Harbors usable by a player: they own a settlement or city on either harbor vertex. */
export function ownedPorts(s:GameState,p:Player){return s.board.ports.filter(pt=>ownerAt(s,pt.a)===p.id||ownerAt(s,pt.b)===p.id);}
/** Best bank rate for each resource: dedicated 2:1 harbor > generic 3:1 harbor > default 4:1. */
export function portRates(s:GameState,p:Player):Record<Resource,number>{const rates:Record<Resource,number>={wood:4,brick:4,wheat:4,wool:4,ore:4};
  for(const pt of ownedPorts(s,p)){if(pt.type==='any'){for(const r of Object.keys(rates) as Resource[])rates[r]=Math.min(rates[r],3);}else rates[pt.type]=2;}
  return rates;}
export function newGame():GameState {
  resetDice(); const board=makeBoard(); const players:Player[]=[
    {id:0,name:'你',kind:'human',color:'#4c9b70',resources:emptyResources(),settlements:new Set(),cities:new Set(),roads:new Set(),knights:0,points:0},
    {id:1,name:'豆豆熊',kind:'ai',color:'#e18a68',resources:emptyResources(),settlements:new Set(),cities:new Set(),roads:new Set(),knights:0,points:0},
    {id:2,name:'栗子兔',kind:'ai',color:'#8d8ed1',resources:emptyResources(),settlements:new Set(),cities:new Set(),roads:new Set(),knights:0,points:0},
    {id:3,name:'棉花羊',kind:'ai',color:'#d6a84f',resources:emptyResources(),settlements:new Set(),cities:new Set(),roads:new Set(),knights:0,points:0}
  ];
  const order=[0,1,2,3,3,2,1,0];
  return {board,players,currentPlayer:0,phase:'setup-settlement',setupOrder:order,setupIndex:0,pendingVertex:null,robberTile:board.tiles.find(t=>t.terrain==='desert')!.id,dice:null,winner:null,log:['歡迎來到森友拓荒島！先完成兩輪初始建設。'],message:'選擇一個空的交叉點，放置第一座村莊。',alerts:[]};
}
export function emptyResources():Record<Resource,number>{return {wood:0,brick:0,wheat:0,wool:0,ore:0};}
export function cost(type:'road'|'settlement'|'city'|'dev'):Partial<Record<Resource,number>>{return type==='road'?{wood:1,brick:1}:type==='settlement'?{wood:1,brick:1,wheat:1,wool:1}:type==='city'?{wheat:2,ore:3}:{wheat:1,wool:1,ore:1};}
export function canPay(p:Player,c:Partial<Record<Resource,number>>){return (Object.entries(c) as [Resource,number][]).every(([r,n])=>p.resources[r]>=n);}
export function pay(p:Player,c:Partial<Record<Resource,number>>){if(!canPay(p,c))return false;for(const [r,n] of Object.entries(c) as [Resource,number][])p.resources[r]-=n;return true;}
export function ownerAt(s:GameState,v:string):number|null{for(const p of s.players)if(p.settlements.has(v)||p.cities.has(v))return p.id;return null;}
export function roadOwner(s:GameState,e:string):number|null{for(const p of s.players)if(p.roads.has(e))return p.id;return null;}
export function settlementDistanceOK(s:GameState,v:string){const vertex=s.board.vertices.get(v);if(!vertex||ownerAt(s,v)!==null)return false;return vertex.edges.every(e=>{const edge=s.board.edges.get(e)!;const other=edge.a===v?edge.b:edge.a;return ownerAt(s,other)===null;});}
export function canBuildSettlement(s:GameState,p:Player,v:string,setup=false){if(!settlementDistanceOK(s,v))return false;if(setup)return true;const vertex=s.board.vertices.get(v)!;return vertex.edges.some(e=>p.roads.has(e));}
export function canBuildRoad(s:GameState,p:Player,eid:string,setup=false){if(p.roads.has(eid)||roadOwner(s,eid)!==null)return false;const e=s.board.edges.get(eid)!;if(setup)return s.pendingVertex===e.a||s.pendingVertex===e.b;return [e.a,e.b].some(v=>{const own=ownerAt(s,v);if(own===p.id)return true;const vert=s.board.vertices.get(v)!;return own===null&&vert.edges.some(other=>other!==eid&&p.roads.has(other));});}
export function placeSettlement(s:GameState,p:Player,v:string,setup=false){if(!canBuildSettlement(s,p,v,setup))return false;if(!setup&&!pay(p,cost('settlement')))return false;p.settlements.add(v);p.points++;if(setup&&s.setupIndex>=4){for(const tid of s.board.vertices.get(v)!.tiles){const t=s.board.tiles.find(x=>x.id===tid)!;if(t.terrain!=='desert')p.resources[t.terrain]++;}}return true;}
export function placeRoad(s:GameState,p:Player,eid:string,setup=false){if(!canBuildRoad(s,p,eid,setup))return false;if(!setup&&!pay(p,cost('road')))return false;p.roads.add(eid);return true;}
export function upgradeCity(s:GameState,p:Player,v:string){if(!p.settlements.has(v)||!pay(p,cost('city')))return false;p.settlements.delete(v);p.cities.add(v);p.points++;return true;}
// Dice deck: all 36 combinations of 2d6 shuffled, reshuffled when few remain. Keeps the classic 2d6 bell curve
// while greatly reducing streaks; additionally avoids the same total twice in a row when possible.
const DICE_RESHUFFLE_AT=6;
function rand(n:number){const buf=new Uint32Array(1);crypto.getRandomValues(buf);return buf[0]%n;}
let diceDeck:[number,number][]=[];let lastTotals:number[]=[];
function refillDiceDeck(){diceDeck=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)diceDeck.push([a,b]);for(let i=diceDeck.length-1;i>0;i--){const j=rand(i+1);[diceDeck[i],diceDeck[j]]=[diceDeck[j],diceDeck[i]];}}
export function resetDice(){diceDeck=[];lastTotals=[];}
function drawDice():[number,number]{if(diceDeck.length<=DICE_RESHUFFLE_AT)refillDiceDeck();let idx=diceDeck.length-1;
  let total=diceDeck[idx][0]+diceDeck[idx][1];
  let attempts=2;
  while(attempts>0&&lastTotals.includes(total)){
    const alt=diceDeck.map((d,i)=>[d,i] as const).filter(([d])=>!lastTotals.includes(d[0]+d[1]));
    if(alt.length){idx=alt[rand(alt.length)][1];total=diceDeck[idx][0]+diceDeck[idx][1];}
    attempts--;
  }
  const [d]=diceDeck.splice(idx,1);
  lastTotals.push(total);
  if(lastTotals.length>2)lastTotals.shift();
  return d;
}
const fmtRes=(m:Partial<Record<Resource,number>>)=>(Object.entries(m) as [Resource,number][]).filter(([,n])=>n>0).map(([r,n])=>`${RESOURCE_INFO[r].icon}${RESOURCE_INFO[r].label}×${n}`).join('、');
export function rollDice(s:GameState){const [a,b]=drawDice();s.dice=[a,b];const total=a+b;if(total===7){log(s,`擲出 ${a}+${b}=7，觸發盜賊。`);
    // Rule: anyone holding more than 7 cards discards half (rounded down).
    let humanNeedsToDiscard=false;
    for(const p of s.players){const count=resourceCount(p);if(count>7){
      let discard=Math.floor(count/2);
      if(p.kind==='human'){humanNeedsToDiscard=true;continue;}
      const lost:Partial<Record<Resource,number>>={};const keys:Resource[]=['wood','brick','wheat','wool','ore'];while(discard>0){const available=keys.filter(r=>p.resources[r]>0);if(!available.length)break;const r=available[Math.floor(Math.random()*available.length)];p.resources[r]--;lost[r]=(lost[r]??0)+1;discard--;}
      log(s,`${p.name} 手牌 ${count} 張超過 7 張，隨機棄掉一半：${fmtRes(lost)}`);
    }}
    if(humanNeedsToDiscard){s.phase='discard';s.message='擲出 7！你的手牌超過 7 張，請選擇要棄掉的資源。';}
    else{s.phase='robber';s.message='擲出 7！請選擇一塊新的地形移動盜賊。';}
    return;}
  const gained:Record<number,number>={};for(const t of s.board.tiles){if(t.number!==total||t.id===s.robberTile)continue;for(const vid of t.vertices){const owner=ownerAt(s,vid);if(owner===null)continue;const p=s.players[owner];if(t.terrain==='desert')continue;const amount=p.cities.has(vid)?2:1;p.resources[t.terrain]+=amount;gained[owner]=(gained[owner]??0)+amount;}}
  log(s,`擲出 ${a}+${b}=${total}。${Object.entries(gained).map(([id,n])=>`${s.players[+id].name} +${n}`).join('、')||'本次沒有資源產出'}`);s.phase='main';s.message='輪到你行動：建設、交易，或結束回合。';}
export function discardResources(s:GameState,p:Player,lost:Partial<Record<Resource,number>>){
  const count=resourceCount(p);const needed=Math.floor(count/2);
  let total=0;for(const n of Object.values(lost))if(n)total+=n;
  if(total!==needed)return false;
  for(const [r,n] of Object.entries(lost) as [Resource,number][]){if(!n)continue;if(p.resources[r]<n)return false;p.resources[r]-=n;}
  log(s,`你手牌 ${count} 張超過 7 張，棄掉一半：${fmtRes(lost)}`);
  s.phase='robber';s.message='請選擇一塊新的地形移動盜賊。';
  return true;
}
export function moveRobber(s:GameState,tileId:string,p:Player){if(tileId===s.robberTile)return false;s.robberTile=tileId;const tile=s.board.tiles.find(t=>t.id===tileId)!;const candidates=new Set<number>();for(const v of tile.vertices){const owner=ownerAt(s,v);if(owner!==null&&owner!==p.id&&resourceCount(s.players[owner])>0)candidates.add(owner);}if(candidates.size){const victim=s.players[[...candidates][Math.floor(Math.random()*candidates.size)]];const resources=(Object.keys(victim.resources) as Resource[]).filter(r=>victim.resources[r]>0);if(resources.length){const r=resources[Math.floor(Math.random()*resources.length)];victim.resources[r]--;p.resources[r]++;log(s,`${p.name} 移動盜賊並從 ${victim.name} 偷走 ${RESOURCE_INFO[r].icon}${RESOURCE_INFO[r].label}。`);if(victim.kind==='human')s.alerts.push(`🦹 ${p.name} 移動盜賊，從你這裡偷走了 1 張${RESOURCE_INFO[r].icon}${RESOURCE_INFO[r].label}`);}}else log(s,`${p.name} 將盜賊移到新地形。`);s.phase='main';s.message='盜賊已移動。你可以繼續建設。';return true;}
export function resourceCount(p:Player){return Object.values(p.resources).reduce((a,b)=>a+b,0);}
export function log(s:GameState,msg:string){s.log.unshift(msg);s.log=s.log.slice(0,30);}
export function refreshScore(s:GameState){for(const p of s.players)p.points=p.settlements.size+p.cities.size*2;}
export function checkWinner(s:GameState){refreshScore(s);const winner=s.players.find(p=>p.points>=10);if(winner){s.winner=winner.id;s.phase='over';s.message=`${winner.name} 達到 10 分，獲得勝利！`;log(s,s.message);return true;}return false;}
export function longestRoad(s:GameState,p:Player){let best=0;const walk=(v:string,used:Set<string>):number=>{let max=0;for(const eid of s.board.vertices.get(v)?.edges??[]){if(!p.roads.has(eid)||used.has(eid))continue;const e=s.board.edges.get(eid)!;const next=e.a===v?e.b:e.a;const owner=ownerAt(s,next);if(owner!==null&&owner!==p.id){max=Math.max(max,1);continue;}const nextUsed=new Set(used);nextUsed.add(eid);max=Math.max(max,1+walk(next,nextUsed));}return max;};for(const eid of p.roads){const e=s.board.edges.get(eid)!;best=Math.max(best,walk(e.a,new Set()),walk(e.b,new Set()));}return best;}
export function doBankTrade(p:Player,give:Resource,take:Resource,rate=4){if(give===take||p.resources[give]<rate)return false;p.resources[give]-=rate;p.resources[take]++;return true;}
export function aiTakeTurn(s:GameState,p:Player){if(s.phase==='over')return;const candidates=[...s.board.vertices.keys()].filter(v=>canBuildSettlement(s,p,v));for(const v of candidates){if(canPay(p,cost('settlement'))&&placeSettlement(s,p,v)){log(s,`${p.name} 建造了一座村莊。`);checkWinner(s);return;}}
  for(const v of p.settlements){if(canPay(p,cost('city'))&&upgradeCity(s,p,v)){log(s,`${p.name} 將村莊升級為城市。`);checkWinner(s);return;}}
  const roads=[...s.board.edges.keys()].filter(e=>canBuildRoad(s,p,e));for(const e of roads){if(canPay(p,cost('road'))&&placeRoad(s,p,e)){log(s,`${p.name} 修築了一條道路。`);return;}}
  const resources:Resource[]=['wood','brick','wheat','wool','ore'];const rates=portRates(s,p);
  for(const need of resources){if(p.resources[need]===0){const give=resources.filter(r=>r!==need&&p.resources[r]>=rates[r]).sort((a,b)=>rates[a]-rates[b]||p.resources[b]-p.resources[a])[0];if(give&&doBankTrade(p,give,need,rates[give])){log(s,`${p.name} 用 ${rates[give]} 張${RESOURCE_INFO[give].label}換了 1 張${RESOURCE_INFO[need].label}${rates[give]<4?'（港口優惠）':''}。`);break;}}}
}
