// Chanclazo arcade 3D layer (three.js). World coords are the game's pixel coords; 1 unit = 50 px.
import * as THREE from 'three';
import {GLTFLoader} from '/vendor/three/loaders/GLTFLoader.js';
import * as SU from '/vendor/three/utils/SkeletonUtils.js';
const U=50,u=v=>v/U;
const cvs=document.getElementById('g3');
const R=new THREE.WebGLRenderer({canvas:cvs,antialias:true,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio||1,1.5));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputColorSpace=THREE.SRGBColorSpace;
const S=new THREE.Scene();S.background=new THREE.Color(0x150c2a);S.fog=new THREE.Fog(0x150c2a,26,60);
const cam=new THREE.PerspectiveCamera(38,1,.5,200);
S.add(new THREE.HemisphereLight(0x7a86d8,0x2a1838,1.1));
const moon=new THREE.DirectionalLight(0xaab8ff,1.5);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);const sc=moon.shadow.camera;sc.left=-16;sc.right=16;sc.top=16;sc.bottom=-16;sc.near=1;sc.far=60;moon.shadow.bias=-.0015;moon.shadow.normalBias=.03;S.add(moon,moon.target);
const pl=new THREE.PointLight(0xffb060,14,9,1.6);S.add(pl);// warm light following Abuela
const bar=document.getElementById('ld3'),barI=bar&&bar.querySelector('i');
const mgr=new THREE.LoadingManager();mgr.onProgress=(_,a,b)=>{if(barI)barI.style.width=(a/b*100)+'%'};
const LD=new GLTFLoader(mgr);const load=f=>new Promise((ok,no)=>LD.load('/arcade3d/'+f,ok,undefined,no));
const TL=new THREE.TextureLoader(mgr);
// ---------- ground (painted in code) ----------
function ground(WW,WH){const c=document.createElement('canvas'),k=.5;c.width=WW*k;c.height=WH*k;const g=c.getContext('2d');g.scale(k,k);
 g.fillStyle='#1b2340';g.fillRect(0,0,WW,WH);for(let i=0;i<9000;i++){g.fillStyle=Math.random()<.5?'#202a4a':'#161d36';g.fillRect(Math.random()*WW,Math.random()*WH,6+Math.random()*10,3+Math.random()*5)}
 for(let i=0;i<400;i++){g.fillStyle=['#ff8a00','#ffb703','#ff4fd8'][i%3];g.beginPath();g.arc(Math.random()*WW,Math.random()*WH,3,0,7);g.fill()}
 const cob=(test)=>{for(let y=0;y<WH;y+=30){for(let x=((y/30)&1)*20;x<WW;x+=40){if(!test(x+20,y+15))continue;const v=Math.random();g.fillStyle=v<.33?'#4a3d62':v<.66?'#43375a':'#52446c';g.strokeStyle='#1c1430';g.lineWidth=4;g.beginPath();g.roundRect(x+2,y+2,36,26,8);g.fill();g.stroke()}}};
 const cx=WW/2,cy=WH/2;cob((x,y)=>Math.hypot(x-cx,y-cy)<380||Math.abs(x-cx)<70||Math.abs(y-cy)<60||(x>1850&&x<2750&&y>260&&y<960&&(Math.abs((x-1850)%200-100)<40)));
 g.strokeStyle='rgba(255,190,80,.35)';g.lineWidth=8;g.beginPath();g.arc(cx,cy,380,0,7);g.stroke();
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(u(WW),u(WH)),new THREE.MeshStandardMaterial({map:t,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set(u(WW)/2,0,u(WH)/2);m.receiveShadow=true;S.add(m);
 const out=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x0f1428,roughness:1}));out.rotation.x=-Math.PI/2;out.position.set(u(WW)/2,-.02,u(WH)/2);S.add(out);
 // low adobe boundary wall
 const wm=new THREE.MeshStandardMaterial({color:0x5b4a72,roughness:.9}),cap=new THREE.MeshStandardMaterial({color:0xd2774a});
 for(const [x,z,w,d] of [[u(WW)/2,-.3,u(WW)+1,.6],[u(WW)/2,u(WH)+.3,u(WW)+1,.6],[-.3,u(WH)/2,.6,u(WH)],[u(WW)+.3,u(WH)/2,.6,u(WH)]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,1.1,d),wm);b.position.set(x,.55,z);b.castShadow=b.receiveShadow=true;S.add(b);const cp=new THREE.Mesh(new THREE.BoxGeometry(w+.1,.15,d+.15),cap);cp.position.set(x,1.15,z);S.add(cp)}}
// ---------- code-built adobe house ----------
function house(x,z,w,d,col,rot){const g=new THREE.Group();const wall=new THREE.MeshStandardMaterial({color:col,roughness:.85});
 const b=new THREE.Mesh(new THREE.BoxGeometry(w,2.2,d),wall);b.position.y=1.1;b.castShadow=b.receiveShadow=true;g.add(b);
 const roof=new THREE.Mesh(new THREE.CylinderGeometry(.01,Math.hypot(w,d)/2*1.08,1.3,4,1),new THREE.MeshStandardMaterial({color:0xb5432f,roughness:.8}));roof.rotation.y=Math.PI/4;roof.scale.set(w/Math.hypot(w,d)*1.414,1,d/Math.hypot(w,d)*1.414);roof.position.y=2.85;roof.castShadow=true;g.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.7,1.3,.05),new THREE.MeshStandardMaterial({color:0x3a2416}));door.position.set(0,.65,d/2+.02);g.add(door);
 const wl=new THREE.MeshStandardMaterial({color:0xffc060,emissive:0xffa040,emissiveIntensity:1.4});for(const sx of[-w*.3,w*.3]){const wi=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,.05),wl);wi.position.set(sx,1.35,d/2+.02);g.add(wi)}
 const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.04,.18,d+.04),new THREE.MeshStandardMaterial({color:0xf3e6c4}));trim.position.y=2.15;g.add(trim);
 g.position.set(x,0,z);g.rotation.y=rot||0;S.add(g)}
// ---------- papel picado ----------
const PCOL=[0xff4fd8,0xffd23f,0x3be8ff,0x7dff5a,0xff8a00,0xb46bff];let flags=null,flagData=[];
function picado(lines){const geo=new THREE.PlaneGeometry(.42,.52);geo.translate(0,-.26,0);const n=lines.reduce((a,l)=>a+Math.floor(Math.hypot(l[2]-l[0],l[3]-l[1])/.55),0);
 flags=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({side:THREE.DoubleSide,emissive:0xffffff,emissiveIntensity:.08}),n);const col=new THREE.Color();let i=0;
 for(const [x0,z0,x1,z1,h] of lines){const L=Math.hypot(x1-x0,z1-z0),m=Math.floor(L/.55),ang=Math.atan2(z1-z0,x1-x0);for(let k=0;k<m;k++){const q=(k+.5)/m;flagData.push({x:x0+(x1-x0)*q,z:z0+(z1-z0)*q,y:h-Math.sin(q*Math.PI)*.8,r:-ang,p:Math.random()*6});flags.setColorAt(i,col.setHex(PCOL[i%6]));i++}
  const cur=new THREE.CatmullRomCurve3([new THREE.Vector3(x0,h,z0),new THREE.Vector3((x0+x1)/2,h-.8,(z0+z1)/2),new THREE.Vector3(x1,h,z1)]);S.add(new THREE.Mesh(new THREE.TubeGeometry(cur,12,.015,3),new THREE.MeshBasicMaterial({color:0xd8c9a0})))}
 S.add(flags)}
const dm=new THREE.Object3D();
// ---------- props ----------
let PROPS={};const TB=[];
function put(name,x,y,s,rot,r){const src=PROPS[name];if(!src)return null;const o=src.clone();o.position.set(u(x),0,u(y));o.scale.setScalar((s||1)*.6);o.rotation.y=rot||0;o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});S.add(o);if(r)TB.push({k:name,x,y,r:r*.7});return o}
const candleMat=new THREE.MeshBasicMaterial({color:0xffc040});let flames=[];
function flame(x,y,h){const f=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),candleMat);f.scale.y=1.8;f.position.set(u(x),h,u(y));S.add(f);flames.push(f)}
function lamp(x,y,h,i){const l=new THREE.PointLight(0xff9a3c,i||10,10,1.5);l.position.set(u(x),h||1.6,u(y));S.add(l)}
// ---------- enemies ----------
let RIG={},CLIPS={},headTex=null;const live=new Map();const pool={};
const KIND={chiq:'minion',bail:'rogue',brin:'minion',mari:'mage',gordo:'warrior',s:'minion',b:'warrior'};
function mkEnemy(kind){const src=RIG[kind];const o=SU.clone(src.scene);let head=null;
 o.traverse(m=>{if(m.isBone&&/^head$/i.test(m.name))head=m;if(m.isMesh){m.castShadow=true;m.frustumCulled=false;m.material=m.material.clone();const n=m.name.toLowerCase();if(/head|jaw|eyes|skull|helmet/.test(n)&&!/hood/.test(n))m.visible=false;if(/hood|cape|cloak/.test(n))m.material.color.setHex(0x1a1420)}});
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:headTex,transparent:true,alphaTest:.3}));sp.scale.set(1.25,1.25*(245/236),1);sp.position.set(0,.35,.15);sp.center.set(.5,.4);
 (head||o).add(sp);
 const mix=new THREE.AnimationMixer(o);const act=n=>CLIPS[n]?mix.clipAction(CLIPS[n]):null;const run=act('Running_A')||act('Walking_A');run&&run.play();
 const box=new THREE.Box3().setFromObject(o);const h0=box.max.y-box.min.y||2.4;
 return {o,mix,h0,run,atk:act('1H_Melee_Attack_Chop'),mats:(()=>{const a=[];o.traverse(m=>{if(m.isMesh)a.push(m.material)});return a})()}}
function getE(kind){const p=pool[kind]||(pool[kind]=[]);const m=p.pop()||mkEnemy(kind);S.add(m.o);m.o.visible=true;return m}
function relE(kind,m){S.remove(m.o);(pool[kind]||(pool[kind]=[])).push(m)}
// ---------- api ----------
let ready=false,built=false,last=performance.now();const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),ray=new THREE.Raycaster(),gp=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let VW=960,VH=540;
function setCam(cx,cy){const p=window.__P3;const tx=u(cx),tz=u(cy);const dist=VH/U*1.35;cam.position.set(tx,dist*Math.sin(.95),tz+dist*Math.cos(.95));cam.lookAt(tx,0,tz);cam.updateMatrixWorld();cam.updateProjectionMatrix()}
const G3={get ready(){return ready},TB,
 proj(x,y,h){tmp.set(u(x),u(h||0),u(y)).project(cam);tmp2.set(u(x)+1,u(h||0),u(y)).project(cam);const vx=(tmp.x+1)/2*VW,vy=(1-tmp.y)/2*VH;return[vx,vy,Math.hypot((tmp2.x-tmp.x)/2*VW,(tmp2.y-tmp.y)/2*VH)/U]},
 unproj(vx,vy){ray.setFromCamera({x:vx/VW*2-1,y:1-vy/VH*2},cam);const hit=new THREE.Vector3();return ray.ray.intersectPlane(gp,hit)?[hit.x*U,hit.z*U]:null},
 frame(st){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;VW=st.W;VH=st.H;
  const w=innerWidth,h=innerHeight;if(cvs.width!==Math.floor(w*R.getPixelRatio())||cvs.height!==Math.floor(h*R.getPixelRatio())){R.setSize(w,h,false)}cam.aspect=w/h;
  setCam(st.cx,st.cy);
  if(!ready)return;
  const P=st.P;if(P){pl.position.set(u(P.x),2.2,u(P.y));moon.position.set(u(P.x)-8,22,u(P.y)+6);moon.target.position.set(u(P.x),0,u(P.y))}
  const seen=new Set();for(const e of st.E||[]){const kind=KIND[e.t]||'minion';let m=live.get(e);if(!m){m=getE(kind);m.kind=kind;live.set(e,m)}seen.add(e);
   const big=e.t==='b',hgt=e.r*(big?3.4:3.1)*(e.t==='gordo'?1.1:1);const s=u(hgt)/m.h0;m.o.scale.set(s*(e.t==='gordo'?1.3:1),s,s*(e.t==='gordo'?1.3:1));
   m.o.position.set(u(e.x),u(e.z||0),u(e.y));const tgx=e.charm>0?0:(P.x-e.x),tgy=e.charm>0?1:(P.y-e.y);m.o.rotation.y=Math.atan2(tgx,tgy);
   m.mix.timeScale=e.t==='gordo'?.6:e.t==='chiq'?1.5:1;m.mix.update(dt);
   const fl=e.fl>0?1:0,ch=e.charm>0;for(const mt of m.mats){mt.emissive&&mt.emissive.setHex(fl?0xffffff:ch?0x661144:big?0x220a00:0);if(mt.emissiveIntensity!==undefined)mt.emissiveIntensity=fl?.8:1}}
  for(const [e,m] of live)if(!seen.has(e)){live.delete(e);relE(m.kind,m)}
  const t=now/1000;if(flags){for(let i=0;i<flagData.length;i++){const f=flagData[i];dm.position.set(f.x,f.y,f.z);dm.rotation.set(Math.sin(t*2+f.p)*.35,f.r,0);dm.updateMatrix();flags.setMatrixAt(i,dm.matrix)}flags.instanceMatrix.needsUpdate=true}
  for(let i=0;i<flames.length;i++){const f=flames[i];f.scale.y=1.6+Math.sin(t*12+i)*.3}
  R.render(S,cam)},
 async init(){try{
  headTex=TL.load('/play/calavera_gabe.webp');headTex.colorSpace=THREE.SRGBColorSpace;headTex.repeat.set(1,245/457);headTex.offset.set(0,1-245/457);
  const [pr,mi,ro,ma,wa]=await Promise.all(['props.glb','sk_minion.glb','sk_rogue.glb','sk_mage.glb','sk_warrior.glb'].map(load));
  pr.scene.children.forEach(c=>{PROPS[c.name.replace(/[._]\d+$/,'')]=c});
  RIG={minion:mi,rogue:ro,mage:ma,warrior:wa};for(const c of mi.animations)CLIPS[c.name]=c;
  ready=true;if(bar)bar.style.display='none';window.dispatchEvent(new Event('g3ready'))}catch(err){console.warn('3D load failed',err);if(bar)bar.style.display='none'}},
 build(WW,WH){if(built||!ready)return;built=true;const cx=WW/2,cy=WH/2;ground(WW,WH);
  // plaza + ofrenda
  const of=put('shrine_candles',cx,cy-230,2.2,0,70);put('plaque_candles',cx-130,cy-200,1.6,.3,30);put('plaque_candles',cx+130,cy-200,1.6,-.3,30);lamp(cx,cy-200,2.2,16);
  for(const [x,y] of [[cx-260,cy-260],[cx+260,cy-260],[cx-300,cy+220],[cx+300,cy+220]]){put('post_lantern',x,y,1.6,0,18);lamp(x,y,2.3,9)}
  for(let i=0;i<14;i++){const a=i/14*6.283,x=cx+Math.cos(a)*400,y=cy+Math.sin(a)*400;put(i%3?'candle':'candle_triple',x,y,1.4,a,0);flame(x,y,.33)}
  put('bench_decorated',cx-200,cy+60,1.6,Math.PI/2,40);put('bench_decorated',cx+200,cy+60,1.6,-Math.PI/2,40);
  // graveyard NE
  const gx0=1900,gy0=320;for(let r=0;r<4;r++)for(let c=0;c<5;c++){const x=gx0+c*200+(r%2)*40,y=gy0+r*170;const nm=['gravestone','grave_A','grave_B','gravemarker_A','gravemarker_B'][(r*5+c)%5];put(nm,x,y,1.7,(Math.random()-.5)*.3,32);if((r+c)%3===0){put('candle_melted',x+40,y+30,1.4,0,0);flame(x+40,y+30,.27)}}
  put('crypt',2650,1500,2.0,-Math.PI/2,110);lamp(2560,1500,2,10);put('arch_gate',1820,640,1.8,Math.PI/2,0);
  put('coffin_decorated',2150,1150,1.5,.4,40);
  // houses W and S
  const HC=[0xd9618f,0x2f9fb3,0xe39a3a,0x7d5cc4,0x4fae63,0xc94c4c];const hs=[[420,420,0],[860,380,0],[420,880,Math.PI/2],[520,1650,0],[950,1980,0],[1500,2120,0],[2050,1990,0],[2500,2080,0]];
  hs.forEach(([x,y,r],i)=>{house(u(x),u(y),4.2,3.2,HC[i%6],r);TB.push({k:'house',x,y,r:105})});
  // trees
  const tr=[[200,1300,'tree_dead_large'],[1150,500,'tree_pine_orange_large'],[1250,800,'tree_dead_medium'],[2800,300,'tree_dead_large_decorated'],[2850,900,'tree_pine_orange_medium'],[2300,1300,'tree_pine_yellow_medium'],[900,1300,'tree_pine_orange_medium'],[250,2200,'tree_dead_large'],[1250,1700,'tree_dead_medium'],[1800,1700,'tree_pine_orange_large'],[2850,2250,'tree_dead_medium'],[700,1100,'tree_pine_yellow_medium']];
  for(const [x,y,n] of tr)put(n,x,y,2.2,Math.random()*6,34);
  // pumpkins, bones, skulls decor
  for(const [x,y,n] of [[700,620,'pumpkin_orange_jackolantern'],[1100,2100,'pumpkin_orange'],[2400,1800,'pumpkin_orange_jackolantern'],[1800,450,'skull_candle'],[600,1900,'skull_candle'],[2000,1450,'ribcage'],[1300,300,'bone_A'],[2600,1100,'skull'],[300,600,'lantern_standing'],[2850,1600,'lantern_standing']]){put(n,x,y,1.6,Math.random()*6,n.startsWith('pumpkin')||n==='lantern_standing'?24:0);if(n.includes('candle')||n.includes('jack')||n.startsWith('lantern'))lamp(x,y,1.2,5)}
  // papel picado strings (units)
  picado([[u(cx-420),u(cy-60),u(cx+420),u(cy-60),3.4],[u(cx-420),u(cy+120),u(cx+420),u(cy+120),3.4],[u(400),u(560),u(860),u(520),3.2],[u(520),u(1780),u(950),u(2100),3.2],[u(1500),u(2240),u(2050),u(2100),3.2],[u(2050),u(2100),u(2500),u(2200),3.2]]);
 }};
window.G3=G3;G3.init();
