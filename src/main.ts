import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {newGame, RESOURCE_INFO, cost, canPay, pay, canBuildRoad, canBuildSettlement, placeRoad, placeSettlement, upgradeCity, rollDice, moveRobber, checkWinner, log, type GameState, type Player, type Resource, type Terrain, doBankTrade, aiTakeTurn, longestRoad, discardResources, resourceCount} from './game';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div class="shell">
  <header class="topbar"><div class="brand"><button id="menuBtn" class="menu-btn">≡</button><div class="brand-icon">🌿</div><div><div class="brand-title">森友拓荒島</div><div class="brand-sub">COZY CATAN · 3D ISLAND ADVENTURE</div></div></div><div class="top-actions"><label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;"><input type="checkbox" id="sfxToggle" checked>音效</label><label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;"><input type="checkbox" id="bgmToggle" checked>音樂</label><input type="range" id="bgmVolume" min="0" max="1" step="0.01" value="0.35" style="width:60px;margin-right:12px;" title="音樂音量"><span class="pill">✦ 單人拓荒模式</span><button id="restart" class="soft-button">↻ 重新開始</button></div></header>
  <main class="layout"><section class="board-panel"><div class="board-heading"><div><div class="eyebrow">YOUR LITTLE ISLAND</div><h1>一起打造理想小島</h1><p>收集資源、修築道路，讓島嶼慢慢熱鬧起來。</p></div><div class="turn-card"><div class="turn-dot" id="turnDot"></div><div><small>目前回合</small><strong id="turnName">你</strong></div><div class="dice-chip" id="diceValue">🎲 —</div></div></div><div id="scene-wrap"><div id="scene"></div><div class="scene-hint" id="sceneHint">點擊交叉點放置村莊</div><div class="zoom-controls"><button id="zoomIn" aria-label="放大">＋</button><button id="zoomOut" aria-label="縮小">−</button><button id="resetView" aria-label="重設視角">⌂</button></div></div><div class="legend"><span><i class="dot forest"></i>森林</span><span><i class="dot hills"></i>丘陵</span><span><i class="dot field"></i>麥田</span><span><i class="dot pasture"></i>牧場</span><span><i class="dot mountain"></i>山脈</span><span><i class="dot desert"></i>沙漠</span></div></section>
  <aside class="sidebar"><section class="panel resource-panel"><div class="section-title"><h2>你的背包</h2><span class="tiny-label">RESOURCES</span></div><div class="resource-grid" id="resources"></div><div class="hand-total"><span>手牌總數</span><strong id="handTotal">0 張</strong></div></section>
  <section class="panel action-panel">
      <div id="swipeEndHint" class="swipe-end-hint"><span>👉 滑動結束回合</span></div>
      <div id="actionScroll" class="action-panel-scroll">
        <div class="section-title"><h2>島嶼行動</h2><span class="tiny-label" id="phaseTag">初始配置</span></div><p class="status-message" id="statusMessage">選擇一個空的交叉點，放置第一座村莊。</p><div class="action-grid"><button class="action-button primary" id="rollBtn"><span>🎲</span><b>擲骰子</b><small>開始你的回合</small></button><button class="action-button" id="buildRoad"><span>🛤️</span><b>修築道路</b><small>🪵 1 + 🧱 1</small></button><button class="action-button" id="buildVillage"><span>🏡</span><b>建造村莊</b><small>木、磚、小麥、羊</small></button><button class="action-button" id="buildCity"><span>🏘️</span><b>升級城市</b><small>🌾 2 + ⛰️ 3</small></button></div><div class="trade-row"><div><b>銀行交易</b><small>4 張相同資源換 1 張</small></div><button id="tradeBtn" class="outline-button">交換資源</button></div><div id="endTurn" class="slide-to-end disabled"><div class="slide-text">滑動結束回合 ❯❯</div><div class="slide-thumb">➜</div></div>
      </div>
    </section>
  <section class="panel players-panel"><div class="section-title"><h2>島民夥伴</h2><span class="tiny-label">4 PLAYERS</span></div><div id="players"></div></section>
  <section class="panel log-panel"><div class="section-title"><h2>島嶼日誌</h2><span class="tiny-label">RECENT EVENTS</span></div><div id="logList" class="log-list"></div></section></aside></main>
  <footer><span>🌱 慢慢建設，也是一種冒險。</span><span>Prototype v0.1 · Three.js + TypeScript</span></footer>
</div>
<div class="modal-backdrop hidden" id="modal"><div class="modal-card"><button class="modal-close" id="modalClose">×</button><div id="modalContent"></div></div></div>`;

const wrap=document.querySelector<HTMLDivElement>('#scene')!;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#d8eee8'); scene.fog=new THREE.Fog('#d8eee8',22,48);
const camera=new THREE.PerspectiveCamera(35,1,0.1,100); camera.position.set(11,16,17); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;wrap.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.05;controls.maxPolarAngle=Math.PI/2-0.05;controls.minDistance=5;controls.maxDistance=50;controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
scene.add(new THREE.HemisphereLight(0xffffff,0x8eb5a1,2.1));const sun=new THREE.DirectionalLight(0xfff1d5,3.2);sun.position.set(-8,16,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const ocean=new THREE.Mesh(new THREE.CylinderGeometry(11.7,11.7,.35,96),new THREE.MeshStandardMaterial({color:'#76c9c7',roughness:.8}));ocean.position.y=-.42;ocean.receiveShadow=true;scene.add(ocean);
const islandBase=new THREE.Mesh(new THREE.CylinderGeometry(9.6,9.2,.7,96),new THREE.MeshStandardMaterial({color:'#d7c29a',roughness:1}));islandBase.position.y=-.1;islandBase.receiveShadow=true;scene.add(islandBase);
const boardGroup=new THREE.Group();scene.add(boardGroup);const piecesGroup=new THREE.Group();scene.add(piecesGroup);const markerGroup=new THREE.Group();scene.add(markerGroup);
let state:GameState=newGame();let buildMode:'road'|'settlement'|'city'|null=null;let selectedRobber=false;let hitObjects:THREE.Object3D[]=[];let objectAction=new Map<THREE.Object3D,{kind:'vertex'|'edge'|'tile';id:string}>();let vertexMeshes=new Map<string,THREE.Mesh>();let edgeMeshes=new Map<string,THREE.Mesh>();let tileMeshes=new Map<string,THREE.Mesh>();
const terrainColors:Record<Terrain,string>={wood:'#4d956b',brick:'#cf846a',wheat:'#e9c75f',wool:'#a7cb8d',ore:'#899baa',desert:'#dfc58c'};
const tileNames:Record<Terrain,string>={wood:'森林',brick:'丘陵',wheat:'麥田',wool:'牧場',ore:'山脈',desert:'沙漠'};
function mat(color:string,roughness=.8){return new THREE.MeshStandardMaterial({color,roughness});}
function makeTextSprite(text:string,bg:string='#fffaf0',fg='#4b5e4d'){const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(14,18,228,92,34);ctx.fill();ctx.strokeStyle='rgba(70,90,70,.18)';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle=fg;ctx.font='bold 48px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,65);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.scale.set(.82,.41,1);return sprite;}
// Flat round number token lying on the tile, with probability pips. Uses normal depth testing so roads, houses and the
// robber stay in front of it. toneMapped:false keeps the colors crisp under ACES tone mapping.
function makeNumberToken(n:number){const hot=n===6||n===8;const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);ctx.lineWidth=14;ctx.strokeStyle=hot?'#d32f2f':'#333333';ctx.beginPath();ctx.arc(128,128,118,0,Math.PI*2);ctx.stroke();ctx.fillStyle=hot?'#d32f2f':'#111111';ctx.font='900 144px system-ui, "Segoe UI", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n),128,114);const pips=6-Math.abs(7-n);const gap=24;for(let i=0;i<pips;i++){ctx.beginPath();ctx.arc(128+(i-(pips-1)/2)*gap,205,8,0,Math.PI*2);ctx.fill();}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const g=new THREE.Group();const R=.24;const base=new THREE.Mesh(new THREE.CylinderGeometry(R,R,.04,32),mat('#fdfaf2'));base.position.y=.02;base.castShadow=true;base.receiveShadow=true;g.add(base);
  const face=new THREE.Mesh(new THREE.CircleGeometry(R*.96,32),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));face.rotation.x=-Math.PI/2;face.position.y=.0415;g.add(face);return g;}
function disposeGroup(g:THREE.Group){g.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();const mt=m.material as THREE.Material|THREE.Material[]|undefined;const free=(x:THREE.Material)=>{(x as THREE.MeshBasicMaterial).map?.dispose();x.dispose();};if(Array.isArray(mt))mt.forEach(free);else if(mt)free(mt);});g.clear();}
function buildBoard(){disposeGroup(boardGroup);disposeGroup(piecesGroup);disposeGroup(markerGroup);hitObjects=[];objectAction.clear();vertexMeshes.clear();edgeMeshes.clear();tileMeshes.clear();
  // CylinderGeometry with 6 segments already has corners at 30°+60°k (pointy-top), matching the board vertices in game.ts — no extra rotation.
  for(const t of state.board.tiles){const cx=Math.sqrt(3)*(t.q+t.r/2),cz=1.5*t.r;const shape=new THREE.CylinderGeometry(.98,.98,.28,6,1,false);const tile=new THREE.Mesh(shape,mat(terrainColors[t.terrain]));tile.position.set(cx,.12,cz);tile.castShadow=true;tile.receiveShadow=true;tile.userData={kind:'tile',id:t.id};boardGroup.add(tile);tileMeshes.set(t.id,tile);hitObjects.push(tile);objectAction.set(tile,{kind:'tile',id:t.id});
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.035,6),mat(t.terrain==='desert'?'#e8d5a5':terrainColors[t.terrain]));top.position.set(cx,.285,cz);boardGroup.add(top);
    // Decorations sit on a ring around the central number token so the number stays readable and the edges/corners stay clear.
    const ring=(count:number,radius=.50,offset=0)=>Array.from({length:count},(_,k)=>{const a=offset+k*Math.PI*2/count;return {x:cx+Math.cos(a)*radius,z:cz+Math.sin(a)*radius,a};});
    const add=(m:THREE.Mesh,shadow=true)=>{m.castShadow=shadow;boardGroup.add(m);return m;};
    if(t.terrain==='wood'){ring(6,.50,Math.PI/6).forEach((p,k)=>{add(new THREE.Mesh(new THREE.CylinderGeometry(.03,.045,.14,6),mat('#8a6545')),false).position.set(p.x,.37,p.z);add(new THREE.Mesh(new THREE.ConeGeometry(.13,.32,7),mat(k%2?'#377c58':'#4b956b'))).position.set(p.x,.58,p.z);});}
    if(t.terrain==='brick'){ring(5,.48,0).forEach((p,k)=>{const b=add(new THREE.Mesh(new THREE.BoxGeometry(.2,.09,.11),mat(k%2?'#b86f59':'#c97d62')));b.position.set(p.x,.35,p.z);b.rotation.y=-p.a;if(k%2===0){const top=add(new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.1),mat('#a8604c')));top.position.set(p.x,.44,p.z);top.rotation.y=-p.a+.3;}});}
    if(t.terrain==='wheat'){ring(9,.48).forEach((p,k)=>{const s=add(new THREE.Mesh(new THREE.CylinderGeometry(.016,.022,.28,5),mat('#c69b35')),false);s.position.set(p.x,.44,p.z);s.rotation.z=k%2?.15:-.15;const head=add(new THREE.Mesh(new THREE.SphereGeometry(.04,6,5),mat('#e2b84a')),false);head.position.set(p.x+(k%2?-.02:.02),.59,p.z);head.scale.set(.8,1.6,.8);});}
    if(t.terrain==='wool'){ring(4,.48,Math.PI/4).forEach(p=>{const sheep=add(new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),mat('#f7f4e7')));sheep.position.set(p.x,.4,p.z);sheep.scale.set(1.15,.8,.8);sheep.rotation.y=-p.a+Math.PI/2;const hx=p.x+Math.cos(p.a+Math.PI/2)*.13,hz=p.z+Math.sin(p.a+Math.PI/2)*.13;add(new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),mat('#5d5a55')),false).position.set(hx,.43,hz);});}
    if(t.terrain==='ore'){ring(5,.50,Math.PI/5).forEach((p,k)=>{add(new THREE.Mesh(new THREE.ConeGeometry(.15,k%2?.34:.44,5),mat(k%2?'#aab6c0':'#7d8b9b'))).position.set(p.x,k%2?.47:.52,p.z);});}
    if(t.terrain==='desert'){ring(3,.48,Math.PI/2).forEach(p=>{add(new THREE.Mesh(new THREE.CylinderGeometry(.05,.065,.32,7),mat('#6d9c6b'))).position.set(p.x,.46,p.z);});}
    if(t.number){const token=makeNumberToken(t.number);token.position.set(cx,.303,cz);boardGroup.add(token);}
  }
  const pickMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  for(const [id,v] of state.board.vertices){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.105,12,10),mat('#fff8e5'));mesh.position.set(v.x,.37,v.z);mesh.castShadow=true;boardGroup.add(mesh);
    const pick=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),pickMat);pick.position.set(v.x,.48,v.z);pick.userData={kind:'vertex',id};boardGroup.add(pick);vertexMeshes.set(id,pick);hitObjects.push(pick);objectAction.set(pick,{kind:'vertex',id});}
  for(const [id,e] of state.board.edges){const va=state.board.vertices.get(e.a)!,vb=state.board.vertices.get(e.b)!;const start=new THREE.Vector3(va.x,.38,va.z),end=new THREE.Vector3(vb.x,.38,vb.z);const direction=new THREE.Vector3().subVectors(end,start);const len=direction.length();const quat=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());const mid=start.clone().add(end).multiplyScalar(.5);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,len,8),mat('#e8dfc6'));mesh.position.copy(mid);mesh.quaternion.copy(quat);boardGroup.add(mesh);
    // Invisible proxy for raycasting at Y=.49 to match visible built roads
    const start2=new THREE.Vector3(va.x,.49,va.z),end2=new THREE.Vector3(vb.x,.49,vb.z);const mid2=start2.clone().add(end2).multiplyScalar(.5);
    const pick=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,len*.85,8),pickMat);pick.position.copy(mid2);pick.quaternion.copy(quat);pick.userData={kind:'edge',id};boardGroup.add(pick);edgeMeshes.set(id,pick);hitObjects.push(pick);objectAction.set(pick,{kind:'edge',id});}
  // Beach rocks and tiny decorative shrubs around the coast.
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+Math.random()*.1,0),mat(i%2?'#f0e4c8':'#a4d7ca'));rock.position.set(Math.cos(a)*9.1,-.03,Math.sin(a)*8.7);rock.scale.y=.55;boardGroup.add(rock);}
  refreshPieces();}
function refreshPieces(){disposeGroup(piecesGroup);for(const p of state.players){for(const v of p.settlements){const pt=state.board.vertices.get(v)!;const base=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.2,6),mat(p.color));base.position.set(pt.x,.48,pt.z);base.castShadow=true;piecesGroup.add(base);const roof=new THREE.Mesh(new THREE.ConeGeometry(.28,.3,4),mat(p.color));roof.position.set(pt.x,.72,pt.z);roof.rotation.y=Math.PI/4;roof.castShadow=true;piecesGroup.add(roof);const door=new THREE.Mesh(new THREE.BoxGeometry(.07,.11,.025),mat('#fff0cf'));door.position.set(pt.x,.47,pt.z+.23);piecesGroup.add(door);}
  for(const v of p.cities){const pt=state.board.vertices.get(v)!;const base=new THREE.Mesh(new THREE.BoxGeometry(.42,.3,.35),mat(p.color));base.position.set(pt.x,.54,pt.z);base.castShadow=true;piecesGroup.add(base);const roof=new THREE.Mesh(new THREE.ConeGeometry(.31,.3,4),mat('#f6e4c4'));roof.position.set(pt.x,.83,pt.z);roof.rotation.y=Math.PI/4;piecesGroup.add(roof);}
  for(const eid of p.roads){const e=state.board.edges.get(eid)!;const va=state.board.vertices.get(e.a)!,vb=state.board.vertices.get(e.b)!;const start=new THREE.Vector3(va.x,.49,va.z),end=new THREE.Vector3(vb.x,.49,vb.z);const dir=new THREE.Vector3().subVectors(end,start);const road=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,dir.length(),7),mat(p.color));road.position.copy(start).add(end).multiplyScalar(.5);road.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());road.castShadow=true;piecesGroup.add(road);}}
  const robber=state.board.tiles.find(t=>t.id===state.robberTile)!;const x=Math.sqrt(3)*(robber.q+robber.r/2),z=1.5*robber.r;const body=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.35,4,8),mat('#5a626a'));body.position.set(x,.69,z);piecesGroup.add(body);const hood=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),mat('#414951'));hood.position.set(x,.95,z);piecesGroup.add(hood);
  // Refresh all vertex/edge pick geometry after rendering pieces; these remain available for raycasting.
  hitObjects=[...vertexMeshes.values(),...edgeMeshes.values(),...tileMeshes.values()];}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let pointerDownPos={x:0,y:0};
renderer.domElement.addEventListener('pointerdown',(e:PointerEvent)=>{pointerDownPos={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',(e:PointerEvent)=>{if(Math.abs(e.clientX-pointerDownPos.x)>5||Math.abs(e.clientY-pointerDownPos.y)>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(hitObjects,false);if(!hits.length)return;const want=wantedKind();const hit=(want&&hits.find(h=>objectAction.get(h.object)?.kind===want))||hits[0];const action=objectAction.get(hit.object);if(action)handleBoardClick(action.kind,action.id);});
function wantedKind():'vertex'|'edge'|'tile'|null{if(state.phase==='setup-settlement')return 'vertex';if(state.phase==='setup-road')return 'edge';if(state.phase==='robber')return 'tile';if(buildMode==='road')return 'edge';if(buildMode==='settlement'||buildMode==='city')return 'vertex';return null;}
function animate(){requestAnimationFrame(animate);if(hintMats.length){const o=.3+.3*(Math.sin(performance.now()/260)+1)/2;for(const m of hintMats)m.opacity=o;}controls.update();renderer.render(scene,camera);}animate();
function addLog(msg:string){log(state,msg);renderUI();}
function current(){return state.players[state.currentPlayer];}
function setupPlayer(){return state.players[state.setupOrder[state.setupIndex]??0];}
function handleBoardClick(kind:'vertex'|'edge'|'tile',id:string){const p=current();if(state.phase==='over')return;
  if(state.phase==='setup-settlement'){const sp=setupPlayer();if(sp.kind!=='human')return;if(kind!=='vertex'||!placeSettlement(state,sp,id,true)){toast('這個位置不能放置村莊');return;}state.pendingVertex=id;state.phase='setup-road';state.currentPlayer=sp.id;state.message='選擇與村莊相連的一條邊，放置道路。';addLog(`${sp.name} 放置了一座初始村莊。`);refreshPieces();renderUI();return;}
  if(state.phase==='setup-road'){const sp=setupPlayer();if(sp.kind!=='human')return;if(kind!=='edge'||!placeRoad(state,sp,id,true)){toast('道路必須與剛放置的村莊相連');return;}addLog(`${sp.name} 放置了一條初始道路。`);state.setupIndex++;state.pendingVertex=null;if(state.setupIndex>=state.setupOrder.length){state.phase='roll';state.currentPlayer=0;state.message='初始配置完成！擲骰開始你的第一回合。';}else{state.currentPlayer=state.setupOrder[state.setupIndex];state.phase='setup-settlement';state.message=`${current().name} 正在放置初始村莊。`;}refreshPieces();renderUI();scheduleAI();return;}
  if(p.kind!=='human')return;
  if(state.phase==='robber'){if(kind!=='tile'){toast('請點擊一塊地形移動盜賊');return;}if(!moveRobber(state,id,p)){toast('盜賊必須移到另一塊地形');return;}refreshPieces();renderUI();return;}
  if(state.phase!=='main')return;
  if(buildMode==='settlement'&&kind==='vertex'){if(!canBuildSettlement(state,p,id)){toast('村莊需連接自己的道路，且與其他建築至少間隔一條空交叉點');return;}if(!placeSettlement(state,p,id)){toast('資源不足或位置不合法');return;}buildMode=null;addLog('你建造了一座村莊。');refreshPieces();checkWinner(state);renderUI();return;}
  if(buildMode==='road'&&kind==='edge'){if(!canBuildRoad(state,p,id)){toast('道路必須連接自己的村莊、城市或道路');return;}if(!placeRoad(state,p,id)){toast('木材或磚頭不足');return;}buildMode=null;addLog('你修築了一條道路。');refreshPieces();renderUI();return;}
  if(buildMode==='city'&&kind==='vertex'){if(!upgradeCity(state,p,id)){toast('請選擇自己的村莊，並確認有 2 小麥與 3 鐵礦');return;}buildMode=null;addLog('你將村莊升級為城市！');refreshPieces();checkWinner(state);renderUI();return;}
  if(kind==='tile')toast(`${tileNames[state.board.tiles.find(t=>t.id===id)!.terrain]}：點選建設按鈕後，再選擇道路或交叉點。`);
}
function toast(msg:string){const hint=document.querySelector<HTMLElement>('#sceneHint')!;hint.textContent=msg;hint.classList.add('show');window.setTimeout(()=>hint.classList.remove('show'),2200);}
// --- Build hints: translucent "ghost" pieces showing every legal spot for the current action ---
let hintMats:THREE.MeshStandardMaterial[]=[];
function ghostMat(color='#8f9a96'){const m=new THREE.MeshStandardMaterial({color,roughness:.7,transparent:true,opacity:.5,depthWrite:false});hintMats.push(m);return m;}
function ghostSettlement(x:number,z:number){const b=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.2,6),ghostMat());b.position.set(x,.48,z);markerGroup.add(b);const r=new THREE.Mesh(new THREE.ConeGeometry(.28,.3,4),ghostMat());r.position.set(x,.72,z);r.rotation.y=Math.PI/4;markerGroup.add(r);}
function ghostCity(x:number,z:number){const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.36,.42),ghostMat('#f2c14e'));b.position.set(x,.56,z);markerGroup.add(b);const r=new THREE.Mesh(new THREE.ConeGeometry(.36,.32,4),ghostMat('#f2c14e'));r.position.set(x,.9,z);r.rotation.y=Math.PI/4;markerGroup.add(r);const ring=new THREE.Mesh(new THREE.TorusGeometry(.38,.035,8,32),ghostMat('#f2c14e'));ring.rotation.x=-Math.PI/2;ring.position.set(x,.4,z);markerGroup.add(ring);}
function ghostRoad(eid:string){const e=state.board.edges.get(eid)!;const va=state.board.vertices.get(e.a)!,vb=state.board.vertices.get(e.b)!;const s=new THREE.Vector3(va.x,.49,va.z),t=new THREE.Vector3(vb.x,.49,vb.z);const d=new THREE.Vector3().subVectors(t,s);const m=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,d.length()*.8,8),ghostMat());m.position.copy(s).add(t).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());markerGroup.add(m);}
function refreshHints(){disposeGroup(markerGroup);hintMats=[];if(state.phase==='over')return;
  const vids=[...state.board.vertices.keys()],eids=[...state.board.edges.keys()];
  if(state.phase==='setup-settlement'){const sp=setupPlayer();if(sp.kind!=='human')return;vids.filter(v=>canBuildSettlement(state,sp,v,true)).forEach(v=>{const pt=state.board.vertices.get(v)!;ghostSettlement(pt.x,pt.z);});return;}
  if(state.phase==='setup-road'){const sp=setupPlayer();if(sp.kind!=='human')return;eids.filter(e=>canBuildRoad(state,sp,e,true)).forEach(ghostRoad);return;}
  const p=current();if(state.phase!=='main'||p.kind!=='human'||!buildMode)return;
  if(buildMode==='settlement')vids.filter(v=>canBuildSettlement(state,p,v)).forEach(v=>{const pt=state.board.vertices.get(v)!;ghostSettlement(pt.x,pt.z);});
  else if(buildMode==='road')eids.filter(e=>canBuildRoad(state,p,e)).forEach(ghostRoad);
  else if(buildMode==='city')[...p.settlements].forEach(v=>{const pt=state.board.vertices.get(v)!;ghostCity(pt.x,pt.z);});
}
function renderUI(){refreshHints();const p=state.players[0];document.querySelector<HTMLElement>('#resources')!.innerHTML=(Object.keys(RESOURCE_INFO) as Resource[]).map(r=>`<div class="resource-card" style="--resource:${RESOURCE_INFO[r].color}"><span>${RESOURCE_INFO[r].icon}</span><small>${RESOURCE_INFO[r].label}</small><strong>${p.resources[r]}</strong></div>`).join('');document.querySelector('#handTotal')!.textContent=`${Object.values(p.resources).reduce((a,b)=>a+b,0)} 張`;
  const active=state.players[state.currentPlayer];document.querySelector<HTMLElement>('#turnName')!.textContent=active.name;document.querySelector<HTMLElement>('#turnDot')!.style.background=active.color;document.querySelector('#diceValue')!.textContent=state.dice?`🎲 ${state.dice[0]+state.dice[1]}`:'🎲 —';document.querySelector('#statusMessage')!.textContent=state.message;document.querySelector('#phaseTag')!.textContent=state.phase.startsWith('setup')?'初始配置':state.phase==='robber'?'盜賊事件':state.phase==='over'?'遊戲結束':state.phase==='roll'?'等待擲骰':'建設階段';document.querySelector('#sceneHint')!.textContent=state.phase==='setup-settlement'?`${active.name}：點擊空交叉點放置村莊`:state.phase==='setup-road'?`${active.name}：點擊與村莊相連的邊放置道路`:state.phase==='robber'?'骰出 7：點擊另一塊地形移動盜賊':buildMode==='road'?'選擇道路位置':buildMode==='settlement'?'選擇村莊位置':buildMode==='city'?'選擇要升級的村莊':state.phase==='roll'?'準備擲骰，開始回合':'選擇建設或結束回合';
  const rollBtn=document.querySelector<HTMLButtonElement>('#rollBtn')!;
  if(state.phase==='discard'&&p.kind==='human'){rollBtn.disabled=false;rollBtn.innerHTML='<span>🗑️</span><b>選擇棄牌</b><small>點此開啟棄牌介面</small>';}
  else if(state.phase==='robber'){rollBtn.disabled=false;rollBtn.innerHTML='<span>🦹</span><b>移動盜賊</b><small>點擊地塊來移動</small>';}
  else{rollBtn.disabled=state.phase!=='roll'||active.kind!=='human';rollBtn.innerHTML='<span>🎲</span><b>擲骰子</b><small>開始你的回合</small>';}
  rollBtn.classList.toggle('disabled',rollBtn.disabled);document.querySelector('#endTurn')!.classList.toggle('disabled', state.phase!=='main'||active.kind!=='human');document.querySelector<HTMLButtonElement>('#buildRoad')!.disabled=state.phase!=='main'||active.kind!=='human'||!canPay(p,cost('road'));document.querySelector<HTMLButtonElement>('#buildVillage')!.disabled=state.phase!=='main'||active.kind!=='human'||!canPay(p,cost('settlement'));document.querySelector<HTMLButtonElement>('#buildCity')!.disabled=state.phase!=='main'||active.kind!=='human'||!canPay(p,cost('city'));document.querySelector<HTMLButtonElement>('#tradeBtn')!.disabled=state.phase!=='main'||active.kind!=='human';
  
document.querySelector('#buildRoad')?.classList.toggle('active', buildMode==='road');
document.querySelector('#buildVillage')?.classList.toggle('active', buildMode==='settlement');
document.querySelector('#buildCity')?.classList.toggle('active', buildMode==='city');

    document.querySelector<HTMLElement>('#players')!.innerHTML=state.players.map(pl=>`<div class="player-row ${pl.id===state.currentPlayer?'active':''}"><div class="avatar" style="--player:${pl.color}">${['🦊','🐻','🐰','🐑'][pl.id]}</div><div class="player-info"><b>${pl.name}${pl.kind==='human'?'（你）':''}</b><small>🏡 ${pl.settlements.size} 村莊 · 🏘️ ${pl.cities.size} 城市 · 🛤️ ${pl.roads.size} 道路</small></div><div class="score"><strong>${pl.points}</strong><small>分</small></div></div>`).join('');
  document.querySelector<HTMLElement>('#logList')!.innerHTML=state.log.map((l,i)=>`<div class="log-item"><span class="log-dot">${i===0?'✦':'·'}</span><span>${l}</span></div>`).join('');
  if(state.phase==='discard'&&!document.querySelector('#discardModal')){
    const p=state.players[0];const needed=Math.floor(resourceCount(p)/2);
    let selected={wood:0,brick:0,wheat:0,wool:0,ore:0} as Record<Resource,number>;
    const updateModal=()=>{
      let count=0;for(const n of Object.values(selected))count+=n;
      const ok=document.querySelector<HTMLButtonElement>('#confirmDiscard');if(ok)ok.disabled=count!==needed;
      const cnt=document.querySelector('#discardCount');if(cnt)cnt.textContent=`${count} / ${needed}`;
      (Object.keys(RESOURCE_INFO) as Resource[]).forEach(r=>{
        const val=document.querySelector(`#val-${r}`),inc=document.querySelector<HTMLButtonElement>(`#inc-${r}`),dec=document.querySelector<HTMLButtonElement>(`#dec-${r}`);
        if(val)val.textContent=String(selected[r]);
        if(inc)inc.disabled=selected[r]>=p.resources[r]||count>=needed;
        if(dec)dec.disabled=selected[r]<=0;
      });
    };
    const rows=(Object.keys(RESOURCE_INFO) as Resource[]).map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:14px"><span>${RESOURCE_INFO[r].icon} ${RESOURCE_INFO[r].label} (有 ${p.resources[r]} 個)</span><div style="display:flex;gap:12px;align-items:center"><button id="dec-${r}" class="soft-button" style="padding:4px 12px;border-radius:6px">-</button><span id="val-${r}" style="width:20px;text-align:center;font-weight:bold">0</span><button id="inc-${r}" class="soft-button" style="padding:4px 12px;border-radius:6px">+</button></div></div>`).join('');
    showModal(`<div id="discardModal"><div class="modal-emoji">🗑️</div><div class="eyebrow">DISCARD RESOURCES</div><h2>請選擇要棄掉的資源</h2><p>你的手牌超過 7 張，請選擇棄掉 <strong id="discardCount">0 / ${needed}</strong> 張。</p><div style="margin:20px 0">${rows}</div><button class="modal-primary" id="confirmDiscard" disabled>確認棄牌</button></div>`);
    (Object.keys(RESOURCE_INFO) as Resource[]).forEach(r=>{
      document.querySelector(`#inc-${r}`)?.addEventListener('click',()=>{selected[r]++;updateModal();});
      document.querySelector(`#dec-${r}`)?.addEventListener('click',()=>{selected[r]--;updateModal();});
    });
    document.querySelector('#confirmDiscard')?.addEventListener('click',()=>{
      if(discardResources(state,p,selected)){
        document.querySelector('#modal')!.classList.add('hidden');
        document.querySelector('#modalContent')!.innerHTML='';
        renderUI();
        scheduleAI();
      }
    });
    updateModal();
  }
  if(state.alerts.length&&state.winner===null){const items=state.alerts.splice(0).map(a=>`<li>${a}</li>`).join('');showModal(`<div class="modal-emoji">⚠️</div><div class="eyebrow">RESOURCE NOTICE</div><h2>你的資源有變動</h2><ul class="alert-list">${items}</ul><button class="modal-primary" id="alertOk">知道了</button>`);document.querySelector('#alertOk')?.addEventListener('click',()=>{document.querySelector('#modal')!.classList.add('hidden');document.querySelector('#modalContent')!.innerHTML='';});}
  if(state.winner!==null)showModal(`<div class="modal-emoji">🏆</div><div class="eyebrow">ISLAND CHAMPION</div><h2>${state.players[state.winner].name} 獲勝！</h2><p>${state.players[state.winner].name} 已達到 10 分，這座小島因你們而繁榮。</p><button class="modal-primary" id="playAgain">再開一局</button>`);
}
function scheduleAI(){if(state.phase==='over')return;const p=current();if(p.kind!=='ai')return;window.setTimeout(()=>{if(state.phase==='setup-settlement'){const choices=[...state.board.vertices.keys()].filter(v=>canBuildSettlement(state,p,v,true));if(choices.length){const v=choices[Math.floor(Math.random()*choices.length)];placeSettlement(state,p,v,true);state.pendingVertex=v;state.phase='setup-road';addLog(`${p.name} 放置了一座初始村莊。`);refreshPieces();renderUI();window.setTimeout(()=>{const roads=[...state.board.edges.keys()].filter(e=>canBuildRoad(state,p,e,true));if(roads.length){placeRoad(state,p,roads[Math.floor(Math.random()*roads.length)],true);addLog(`${p.name} 放置了一條初始道路。`);}state.setupIndex++;state.pendingVertex=null;if(state.setupIndex>=state.setupOrder.length){state.phase='roll';state.currentPlayer=0;state.message='初始配置完成！擲骰開始你的第一回合。';}else{state.currentPlayer=state.setupOrder[state.setupIndex];state.phase='setup-settlement';state.message=`${current().name} 正在放置初始村莊。`;}refreshPieces();renderUI();scheduleAI();},350);}return;}
  if(state.phase==='roll'){playDiceSound();rollDice(state);}
  if(state.phase==='discard'){renderUI();return;} // Wait for human to discard
  if(state.phase==='robber'){const choices=state.board.tiles.filter(t=>t.id!==state.robberTile);moveRobber(state,choices[Math.floor(Math.random()*choices.length)].id,p);}
  if(state.phase==='main'){aiTakeTurn(state,p);checkWinner(state);}
  refreshPieces();renderUI();
  if(state.phase!=='over'&&(state.phase as string)!=='discard'&&state.phase!=='setup-road'&&(state.phase as string)!=='setup-settlement')window.setTimeout(endAITurn,500);
  },450);}
function endAITurn(){if(state.phase==='over')return;state.currentPlayer=(state.currentPlayer+1)%state.players.length;state.phase='roll';state.message=`${current().name} 的回合，等待擲骰。`;renderUI();scheduleAI();}
function showModal(html:string){const modal=document.querySelector<HTMLElement>('#modal')!;document.querySelector('#modalContent')!.innerHTML=html;modal.classList.remove('hidden');document.querySelector('#playAgain')?.addEventListener('click',()=>{modal.classList.add('hidden');resetGame();});}
function resetGame(){state=newGame();buildMode=null;selectedRobber=false;buildBoard();renderUI();scheduleAI();}
(document.querySelector('#restart') as HTMLButtonElement).addEventListener('click',()=>{if(confirm('確定要重新開始這座島嗎？目前進度將會消失。'))resetGame();});
let audioCtx: AudioContext | null = null;
function playDiceSound(){
  const sfx=document.querySelector('#sfxToggle') as HTMLInputElement;
  if(sfx && !sfx.checked) return;
  if(!audioCtx) audioCtx = new (window.AudioContext||(window as any).webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const ctx = audioCtx;
  const hit=(time:number,pitch:number,dur:number)=>{
    const osc=ctx.createOscillator();const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type='sine';osc.frequency.setValueAtTime(pitch,time);
    osc.frequency.exponentialRampToValueAtTime(pitch*.5,time+dur);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(1,time+.005);
    gain.gain.exponentialRampToValueAtTime(.01,time+dur);
    osc.start(time);osc.stop(time+dur);
  };
  const now=ctx.currentTime;
  hit(now,400,.08);hit(now+.08,500,.05);hit(now+.2,350,.06);hit(now+.25,450,.05);
}
document.querySelector('#rollBtn')!.addEventListener('click',()=>{
  if(state.phase==='discard'&&state.players[0].kind==='human'){document.querySelector('#discardModal')?.remove();renderUI();return;}
  if(current().kind!=='human')return;
  if(state.phase==='robber'){toast('請點擊地圖上的一塊地形來移動盜賊');return;}
  if(state.phase!=='roll')return;
  playDiceSound();rollDice(state);renderUI();
  if((state as GameState).phase==='robber')toast('骰出 7！請移動盜賊');
});
document.querySelector('#buildRoad')!.addEventListener('click',()=>{buildMode=buildMode==='road'?null:'road';renderUI();});document.querySelector('#buildVillage')!.addEventListener('click',()=>{buildMode=buildMode==='settlement'?null:'settlement';renderUI();});document.querySelector('#buildCity')!.addEventListener('click',()=>{buildMode=buildMode==='city'?null:'city';renderUI();});
document.querySelector('#tradeBtn')!.addEventListener('click',()=>{
  const p=current();const keys=Object.keys(RESOURCE_INFO) as Resource[];
  const getGiveOpts=()=>keys.map(r=>`<option value="${r}">${RESOURCE_INFO[r].icon} ${RESOURCE_INFO[r].label} (${p.resources[r]})</option>`).join('');
  const getTakeOpts=(exclude:Resource)=>keys.filter(r=>r!==exclude).map(r=>`<option value="${r}">${RESOURCE_INFO[r].icon} ${RESOURCE_INFO[r].label} (${p.resources[r]}->${p.resources[r]+1})</option>`).join('');
  showModal(`<div class="eyebrow">BANK EXCHANGE</div><h2>銀行交易</h2><p>用 4 張相同資源，交換 1 張你需要的資源。</p><div class="trade-form"><label>交出資源<select id="giveResource">${getGiveOpts()}</select></label><label>換取資源<select id="takeResource">${getTakeOpts(keys[0])}</select></label></div><button class="modal-primary" id="confirmTrade">確認交換</button>`);
  document.querySelector('#giveResource')?.addEventListener('change',(e)=>{const val=(e.target as HTMLSelectElement).value as Resource;document.querySelector('#takeResource')!.innerHTML=getTakeOpts(val);});
  document.querySelector('#confirmTrade')!.addEventListener('click',()=>{const give=(document.querySelector('#giveResource') as HTMLSelectElement).value as Resource;const take=(document.querySelector('#takeResource') as HTMLSelectElement).value as Resource;if(!doBankTrade(p,give,take)){toast('資源不足，或不能交換相同資源');return;}document.querySelector('#modal')!.classList.add('hidden');document.querySelector('#modalContent')!.innerHTML='';addLog(`你用 4 張${RESOURCE_INFO[give].label}向銀行換取 1 張${RESOURCE_INFO[take].label}。`);renderUI();},{once:true});
});
document.querySelector('#modalClose')!.addEventListener('click',()=>{document.querySelector('#modal')!.classList.add('hidden');document.querySelector('#modalContent')!.innerHTML='';});
document.querySelector('#zoomIn')!.addEventListener('click',()=>{camera.position.multiplyScalar(.9);controls.update();});document.querySelector('#zoomOut')!.addEventListener('click',()=>{camera.position.multiplyScalar(1.1);controls.update();});document.querySelector('#resetView')!.addEventListener('click',()=>{camera.position.set(11,16,17);controls.target.set(0,0,0);controls.update();});
// Keep the turn engine and rendering separate: the board responds only to game-state changes.
buildBoard();renderUI();scheduleAI();

// --- Background Music Logic ---
const bgm = new Audio(import.meta.env.BASE_URL + 'bgm.mp3');
bgm.loop = true;
const bgmVolume = document.querySelector('#bgmVolume') as HTMLInputElement;
const bgmToggle = document.querySelector('#bgmToggle') as HTMLInputElement;

bgm.volume = parseFloat(bgmVolume.value);

bgmVolume.addEventListener('input', () => {
  bgm.volume = parseFloat(bgmVolume.value);
});

bgmToggle.addEventListener('change', () => {
  if (bgmToggle.checked) {
    bgm.play().catch(() => {});
  } else {
    bgm.pause();
  }
});

// Auto-play workaround: start on first user interaction
const startBGM = () => {
  if (bgmToggle.checked && bgm.paused) {
    bgm.play().catch(() => {});
  }
  document.removeEventListener('click', startBGM);
};
document.addEventListener('click', startBGM);

// --- Mobile UX Interactions ---
document.querySelector('#menuBtn')?.addEventListener('click', () => {
  document.querySelector('.players-panel')?.classList.toggle('show');
  document.querySelector('.log-panel')?.classList.toggle('show');
});

const endTurnEl = document.querySelector('#endTurn') as HTMLElement;
if(endTurnEl) {
  const thumb = endTurnEl.querySelector('.slide-thumb') as HTMLElement;
  const text = endTurnEl.querySelector('.slide-text') as HTMLElement;
  let isDragging = false;
  let startX = 0;

  const triggerEndTurn = () => {
    if(state.phase!=='main'||current().kind!=='human')return;
    state.currentPlayer=(state.currentPlayer+1)%state.players.length;
    state.phase='roll';state.dice=null;buildMode=null;
    state.message=`${current().name} 請等待擲骰。`;
    renderUI();scheduleAI();
  };

  const handleStart = (clientX: number) => {
    if(endTurnEl.classList.contains('disabled')) return;
    isDragging = true;
    startX = clientX;
    thumb.style.transition = 'none';
    text.style.opacity = '0.3';
  };

  const handleMove = (clientX: number) => {
    if(!isDragging) return;
    let x = clientX - startX;
    const max = endTurnEl.clientWidth - thumb.clientWidth - 4;
    if(x < 0) x = 0;
    if(x > max) x = max;
    thumb.style.transform = `translateX(${x}px)`;
  };

  const handleEnd = () => {
    if(!isDragging) return;
    isDragging = false;
    thumb.style.transition = 'transform 0.3s ease';
    text.style.opacity = '1';
    
    // Extract current transform X
    const match = thumb.style.transform.match(/translateX\((.*?)px\)/);
    const currentX = match ? parseFloat(match[1]) : 0;
    const max = endTurnEl.clientWidth - thumb.clientWidth - 4;
    
    if(currentX >= max * 0.85) {
      thumb.style.transform = `translateX(${max}px)`;
      setTimeout(() => {
        thumb.style.transform = 'translateX(0px)';
        triggerEndTurn();
      }, 250);
    } else {
      thumb.style.transform = 'translateX(0px)';
    }
  };

  thumb.addEventListener('touchstart', (e) => {
    handleStart(e.touches[0].clientX);
  }, { passive: true });

  thumb.addEventListener('touchmove', (e) => {
    if(!isDragging) return;
    e.preventDefault(); // Prevent scrolling while sliding
    handleMove(e.touches[0].clientX);
  }, { passive: false });

  thumb.addEventListener('touchend', () => {
    handleEnd();
  });

  thumb.addEventListener('mousedown', (e) => {
    handleStart(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if(isDragging) handleMove(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    if(isDragging) handleEnd();
  });
  

  // Mobile swipe-to-end on the action panel
  const actionScroll = document.querySelector('#actionScroll') as HTMLElement;
  const swipeHint = document.querySelector('#swipeEndHint') as HTMLElement;
  if(actionScroll && swipeHint) {
    let panelStartX = 0;
    let panelIsDragging = false;
    let swipeTranslate = 0;

    actionScroll.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 800) return; // Only mobile portrait/HUD
      if (document.querySelector('#endTurn')?.classList.contains('disabled')) return;
      if (actionScroll.scrollLeft > 0) return; // Must be at left edge
      panelIsDragging = true;
      panelStartX = e.touches[0].clientX;
      actionScroll.style.transition = 'none';
      swipeHint.style.opacity = '1';
    }, { passive: true });

    actionScroll.addEventListener('touchmove', (e) => {
      if (!panelIsDragging) return;
      let diff = e.touches[0].clientX - panelStartX;
      if (diff > 0) {
        // Swiping right at the left edge
        if (e.cancelable) e.preventDefault(); // Prevent bounce/scroll
        swipeTranslate = diff * 0.6; // add some friction
        const maxTranslate = window.innerWidth * 0.4;
        if (swipeTranslate > maxTranslate) swipeTranslate = maxTranslate;
        
        actionScroll.style.transform = `translateX(${swipeTranslate}px)`;
        const progress = Math.min(swipeTranslate / (window.innerWidth * 0.25), 1);
        swipeHint.style.background = `rgba(77, 128, 91, ${progress * 0.9})`;
        swipeHint.style.color = progress > 0.5 ? 'white' : '#4d805b';
      }
    }, { passive: false });

    actionScroll.addEventListener('touchend', () => {
      if (!panelIsDragging) return;
      panelIsDragging = false;
      actionScroll.style.transition = 'transform 0.3s ease';
      
      if (swipeTranslate > window.innerWidth * 0.25) {
        // Trigger end turn
        actionScroll.style.transform = `translateX(${window.innerWidth}px)`;
        setTimeout(() => {
          triggerEndTurn();
          actionScroll.style.transform = 'translateX(0px)';
          swipeTranslate = 0;
          swipeHint.style.opacity = '0';
          swipeHint.style.background = 'transparent';
        }, 300);
      } else {
        actionScroll.style.transform = 'translateX(0px)';
        swipeTranslate = 0;
        swipeHint.style.opacity = '0';
        swipeHint.style.background = 'transparent';
      }
    });
  }

  // Keep original click for desktop users
  thumb.addEventListener('click', () => {
    if(!endTurnEl.classList.contains('disabled')) triggerEndTurn();
  });
}
