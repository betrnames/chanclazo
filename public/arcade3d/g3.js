// Chanclazo arcade 3D layer (three.js r170). World coords = game pixel coords; 1 unit = 50 px.
import * as THREE from 'three';
import {GLTFLoader} from '/vendor/three/loaders/GLTFLoader.js';
import * as SU from '/vendor/three/utils/SkeletonUtils.js';
const U=50,u=v=>v/U,SRGB=THREE.SRGBColorSpace;
const cvs=document.getElementById('g3');
const LOW=matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)<700||(navigator.hardwareConcurrency||8)<=4;
const Q={low:LOW,lamps:LOW?3:7,pr:Math.min(devicePixelRatio||1,LOW?1.25:1.75),sh:LOW?512:1024};
const R=new THREE.WebGLRenderer({canvas:cvs,antialias:!LOW,powerPreference:'high-performance'});
R.setPixelRatio(Q.pr);R.shadowMap.enabled=true;R.shadowMap.type=LOW?THREE.BasicShadowMap:THREE.PCFSoftShadowMap;R.outputColorSpace=SRGB;
const S=new THREE.Scene();S.background=new THREE.Color(0x150c2a);S.fog=new THREE.Fog(0x150c2a,26,60);
const cam=new THREE.PerspectiveCamera(38,1,.5,200);
const hemi=new THREE.HemisphereLight(0x7a86d8,0x2a1838,1.1);S.add(hemi);
const moon=new THREE.DirectionalLight(0xaab8ff,1.5);moon.castShadow=true;moon.shadow.mapSize.set(Q.sh,Q.sh);const sc=moon.shadow.camera;sc.left=-16;sc.right=16;sc.top=16;sc.bottom=-16;sc.near=1;sc.far=60;moon.shadow.bias=-.0015;moon.shadow.normalBias=.03;S.add(moon,moon.target);
const pl=new THREE.PointLight(0xffb060,14,9,1.6);S.add(pl);
const bar=document.getElementById('ld3'),barI=bar&&bar.querySelector('i');
const mgr=new THREE.LoadingManager();mgr.onProgress=(_,a,b)=>{if(barI)barI.style.width=(a/b*100)+'%'};
const LD=new GLTFLoader(mgr);const load=f=>new Promise((ok,no)=>LD.load('/arcade3d/'+f,ok,undefined,no));
const TL=new THREE.TextureLoader(mgr);
let LV=new THREE.Group();S.add(LV);const TB=[];let flames=[],flagSets=[],lampN=0;
const rnd=(()=>{let s=7;return()=>{s=(s*16807)%2147483647;return s/2147483647}})();
// ---------- ground ----------
function ground(WW,WH,kind){const c=document.createElement('canvas'),k=.5;c.width=WW*k;c.height=WH*k;const g=c.getContext('2d');g.scale(k,k);
 const base={plaza:['#1b2340','#202a4a','#161d36'],market:['#2a2234','#30273c','#241d2e'],cem:['#16202c','#1b2733','#121a24']}[kind];
 g.fillStyle=base[0];g.fillRect(0,0,WW,WH);for(let i=0;i<9000;i++){g.fillStyle=rnd()<.5?base[1]:base[2];g.fillRect(rnd()*WW,rnd()*WH,6+rnd()*10,3+rnd()*5)}
 for(let i=0;i<(kind==='cem'?700:350);i++){g.fillStyle=['#ff8a00','#ffb703','#ff4fd8'][i%3];g.beginPath();g.arc(rnd()*WW,rnd()*WH,3,0,7);g.fill()}
 const cob=(test,pal)=>{for(let y=0;y<WH;y+=30){for(let x=((y/30)&1)*20;x<WW;x+=40){if(!test(x+20,y+15))continue;g.fillStyle=pal[(rnd()*3)|0];g.strokeStyle='#1c1430';g.lineWidth=4;g.beginPath();g.roundRect(x+2,y+2,36,26,8);g.fill();g.stroke()}}};
 const cx=WW/2,cy=WH/2;
 if(kind==='plaza'){cob((x,y)=>Math.hypot(x-cx,y-cy)<380||Math.abs(x-cx)<70||Math.abs(y-cy)<60,['#4a3d62','#43375a','#52446c']);g.strokeStyle='rgba(255,190,80,.35)';g.lineWidth=8;g.beginPath();g.arc(cx,cy,380,0,7);g.stroke()}
 if(kind==='market'){cob((x,y)=>[600,1200,1800,2400].some(a=>Math.abs(y-a)<90)||Math.abs(x-cx)<90,['#5a4048','#4e3840','#634850'])}
 if(kind==='cem'){g.fillStyle='#2c2430';for(const [x0,y0,x1,y1] of [[cx,0,cx,WH],[0,cy,WW,cy],[cx-700,cy-500,cx+700,cy-500],[cx-700,cy+500,cx+700,cy+500]]){g.save();g.strokeStyle='#352a36';g.lineWidth=110;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();g.restore()}
  cob((x,y)=>Math.hypot(x-cx,y-cy)<260,['#4a3d62','#43375a','#52446c'])}
 const t=new THREE.CanvasTexture(c);t.colorSpace=SRGB;t.anisotropy=4;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(u(WW),u(WH)),new THREE.MeshStandardMaterial({map:t,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set(u(WW)/2,0,u(WH)/2);m.receiveShadow=true;LV.add(m);
 const out=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x0f1428,roughness:1}));out.rotation.x=-Math.PI/2;out.position.set(u(WW)/2,-.02,u(WH)/2);LV.add(out);
 const wm=new THREE.MeshStandardMaterial({color:kind==='cem'?0x4a4458:0x5b4a72,roughness:.9}),cap=new THREE.MeshStandardMaterial({color:kind==='cem'?0x6a6478:0xd2774a});
 for(const [x,z,w,d] of [[u(WW)/2,-.3,u(WW)+1,.6],[u(WW)/2,u(WH)+.3,u(WW)+1,.6],[-.3,u(WH)/2,.6,u(WH)],[u(WW)+.3,u(WH)/2,.6,u(WH)]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,1.1,d),wm);b.position.set(x,.55,z);b.castShadow=b.receiveShadow=true;LV.add(b);const cp=new THREE.Mesh(new THREE.BoxGeometry(w+.1,.15,d+.15),cap);cp.position.set(x,1.15,z);LV.add(cp)}}
// ---------- code-built pieces ----------
const MAT={};const mat=(c,o)=>MAT[c+(o?JSON.stringify(o):'')]||(MAT[c+(o?JSON.stringify(o):'')]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85},o||{})));
function box(w,h,d,c,x,y,z,par,o){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,o));b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;(par||LV).add(b);return b}
function house(px,py,w,d,col,rot){const g=new THREE.Group();box(w,2.2,d,col,0,1.1,0,g);
 const roof=new THREE.Mesh(new THREE.CylinderGeometry(.01,Math.hypot(w,d)/2*1.08,1.3,4,1),mat(0xb5432f));roof.rotation.y=Math.PI/4;roof.scale.set(w/Math.hypot(w,d)*1.414,1,d/Math.hypot(w,d)*1.414);roof.position.y=2.85;roof.castShadow=true;g.add(roof);
 box(.7,1.3,.05,0x3a2416,0,.65,d/2+.02,g);for(const sx of[-w*.3,w*.3])box(.55,.5,.05,0xffc060,sx,1.35,d/2+.02,g,{emissive:0xffa040,emissiveIntensity:1.4});box(w+.04,.18,d+.04,0xf3e6c4,0,2.15,0,g);
 g.position.set(u(px),0,u(py));g.rotation.y=rot||0;LV.add(g);TB.push({k:'house',x:px,y:py,r:105})}
const AWN=[[0xe8243c,0xfff6e0],[0x3b5bdb,0xfff6e0],[0xff8a00,0xffd23f],[0x2f9e44,0xfff6e0],[0xff4fd8,0xffd23f],[0x7d5cc4,0xfff6e0]];
function stall(px,py,i,rot){const g=new THREE.Group();const [a,b]=AWN[i%AWN.length];
 box(2.6,.9,1.2,0x7a4a2a,0,.45,0,g);for(const sx of[-1.2,1.2])for(const sz of[-.55,.55])box(.12,2.3,.12,0x5a3416,sx,1.15,sz,g);
 for(let k=0;k<6;k++){const s=box(2.8/6,.06,1.6,k%2?b:a,-1.4+2.8/12+k*2.8/6,2.35,0,g);s.rotation.x=-.25}
 const fc=[0xff8a00,0xffd23f,0xe8243c,0x7dff5a,0xff4fd8];for(let k=0;k<10;k++){const f=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),mat(fc[(k+i)%5]));f.position.set(-1+k*.22,1,(k%2)*.3-.15);g.add(f)}
 g.position.set(u(px),0,u(py));g.rotation.y=rot||0;LV.add(g);TB.push({k:'stall',x:px-40,y:py,r:60},{k:'stall',x:px+40,y:py,r:60})}
function crate(px,py,s){const b=box(.8*s,.8*s,.8*s,0x9a6a3a,u(px),.4*s,u(py));b.rotation.y=rnd();TB.push({k:'crate',x:px,y:py,r:24*s})}
function tiers(px,py){const g=new THREE.Group();box(3.4,.5,1.8,0x6b3fa0,0,.25,0,g);box(2.6,.5,1.3,0x8a5ac0,0,.75,-.1,g);box(1.8,.5,.9,0xb07be0,0,1.25,-.2,g);
 for(let k=0;k<16;k++){const f=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),mat(k%2?0xff8a00:0xffb703));f.position.set(-1.6+k*.21,.55,.85);g.add(f)}
 g.position.set(u(px),0,u(py));LV.add(g);TB.push({k:'ofr',x:px,y:py,r:90})}
// papel picado (instanced)
const PCOL=[0xff4fd8,0xffd23f,0x3be8ff,0x7dff5a,0xff8a00,0xb46bff];const dm=new THREE.Object3D();
function picado(lines){const geo=new THREE.PlaneGeometry(.42,.52);geo.translate(0,-.26,0);const data=[];for(const [x0,z0,x1,z1,h] of lines){const L=Math.hypot(x1-x0,z1-z0),m=Math.floor(L/.55),ang=Math.atan2(z1-z0,x1-x0);for(let k=0;k<m;k++){const q=(k+.5)/m;data.push({x:x0+(x1-x0)*q,z:z0+(z1-z0)*q,y:h-Math.sin(q*Math.PI)*.8,r:-ang,p:rnd()*6})}
  const cur=new THREE.CatmullRomCurve3([new THREE.Vector3(x0,h,z0),new THREE.Vector3((x0+x1)/2,h-.8,(z0+z1)/2),new THREE.Vector3(x1,h,z1)]);LV.add(new THREE.Mesh(new THREE.TubeGeometry(cur,12,.015,3),new THREE.MeshBasicMaterial({color:0xd8c9a0})))}
 const im=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({side:THREE.DoubleSide,emissive:0xffffff,emissiveIntensity:.08}),data.length);const col=new THREE.Color();data.forEach((_,i)=>im.setColorAt(i,col.setHex(PCOL[i%6])));LV.add(im);flagSets.push({im,data})}
// ---------- kit props ----------
let PROPS={};
function put(name,x,y,s,rot,r){const src=PROPS[name];if(!src)return null;const o=src.clone();o.position.set(u(x),0,u(y));o.scale.setScalar((s||1)*.6);o.rotation.y=rot||0;o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});LV.add(o);if(r)TB.push({k:name,x,y,r:r*.7});return o}
const candleMat=new THREE.MeshBasicMaterial({color:0xffc040});const flameGeo=new THREE.SphereGeometry(.07,6,4);
function flame(x,y,h){const f=new THREE.Mesh(flameGeo,candleMat);f.scale.y=1.8;f.position.set(u(x),h,u(y));LV.add(f);flames.push(f)}
function lamp(x,y,h,i){if(lampN>=Q.lamps)return;lampN++;const l=new THREE.PointLight(0xff9a3c,i||10,10,1.5);l.position.set(u(x),h||1.6,u(y));LV.add(l)}
// ofrenda display board (texture drawn by game: drawOf)
let ofBoard=null,ofKey='';
function ofrendaBoard(px,py,w){const c=document.createElement('canvas');c.width=440;c.height=273;const t=new THREE.CanvasTexture(c);t.colorSpace=SRGB;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*.62),new THREE.MeshBasicMaterial({map:t,transparent:true,alphaTest:.1}));m.position.set(u(px),w*.62/2+1.5,u(py));m.rotation.x=-.25;LV.add(m);ofBoard={c,t};ofKey=''}
// ---------- level layouts ----------
const LAY={
 1(WW,WH){const cx=WW/2,cy=WH/2;ground(WW,WH,'plaza');S.fog.near=26;S.fog.far=60;
  put('shrine_candles',cx,cy-230,2.2,0,70);put('plaque_candles',cx-130,cy-200,1.6,.3,30);put('plaque_candles',cx+130,cy-200,1.6,-.3,30);lamp(cx,cy-200,2.2,16);ofrendaBoard(cx,cy-300,3.2);
  for(const [x,y] of [[cx-260,cy-260],[cx+260,cy-260],[cx-300,cy+220],[cx+300,cy+220]]){put('post_lantern',x,y,1.6,0,18);lamp(x,y,2.3,9)}
  for(let i=0;i<14;i++){const a=i/14*6.283,x=cx+Math.cos(a)*400,y=cy+Math.sin(a)*400;put(i%3?'candle':'candle_triple',x,y,1.4,a,0);flame(x,y,.33)}
  put('bench_decorated',cx-200,cy+60,1.6,Math.PI/2,40);put('bench_decorated',cx+200,cy+60,1.6,-Math.PI/2,40);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=1950+c*200+(r%2)*40,y=320+r*170;put(['gravestone','grave_A','grave_B','gravemarker_A'][(r+c)%4],x,y,1.7,(rnd()-.5)*.3,32)}
  put('arch_gate',1820,560,1.8,Math.PI/2,0);
  const HC=[0xd9618f,0x2f9fb3,0xe39a3a,0x7d5cc4,0x4fae63,0xc94c4c];[[420,420,0],[860,380,0],[420,880,Math.PI/2],[520,1650,0],[950,1980,0],[1500,2120,0],[2050,1990,0],[2500,2080,0]].forEach(([x,y,r],i)=>house(x,y,4.2,3.2,HC[i%6],r));
  for(const [x,y,n] of [[200,1300,'tree_dead_large'],[1150,500,'tree_pine_orange_large'],[2800,300,'tree_dead_large_decorated'],[2850,900,'tree_pine_orange_medium'],[2300,1300,'tree_pine_yellow_medium'],[900,1300,'tree_pine_orange_medium'],[250,2200,'tree_dead_large'],[1800,1700,'tree_pine_orange_large'],[2850,2250,'tree_dead_medium']])put(n,x,y,2.2,rnd()*6,34);
  for(const [x,y,n] of [[700,620,'pumpkin_orange_jackolantern'],[2400,1800,'pumpkin_orange_jackolantern'],[600,1900,'skull_candle'],[300,600,'lantern_standing']]){put(n,x,y,1.6,rnd()*6,24);lamp(x,y,1.2,5)}
  picado([[u(cx-420),u(cy-60),u(cx+420),u(cy-60),3.4],[u(cx-420),u(cy+120),u(cx+420),u(cy+120),3.4],[u(400),u(560),u(860),u(520),3.2],[u(520),u(1780),u(950),u(2100),3.2],[u(1500),u(2240),u(2050),u(2100),3.2]])},
 2(WW,WH){const cx=WW/2;ground(WW,WH,'market');S.fog.near=26;S.fog.far=60;let i=0;
  for(const row of [450,1050,1650,2250])for(const x of [350,750,1150,1850,2250,2650]){stall(x,row-80,i++,0);if(i%3===0)lamp(x,row-60,2.6,9)}
  for(const [x,y] of [[550,700],[960,720],[2050,700],[2450,1300],[600,1900],[2000,1950],[1300,1330],[1700,1320]]){crate(x,y,1);crate(x+30,y+25,.8)}
  for(const [x,y,n] of [[1300,500,'pumpkin_orange'],[1700,1100,'pumpkin_orange_jackolantern'],[300,1300,'lantern_standing'],[2750,1300,'lantern_standing'],[1250,1450,'post_lantern']]){put(n,x,y,1.6,0,26);lamp(x,y,1.6,7)}
  for(const row of [600,1200,1800])picado([[u(150),u(row),u(1350),u(row),3.6],[u(1650),u(row),u(2850),u(row),3.6]]);
  for(const [x,y] of [[150,150],[2850,150],[150,2250],[2850,2250]])put('tree_pine_orange_medium',x,y,2.2,0,34)},
 3(WW,WH){const cx=WW/2,cy=WH/2;ground(WW,WH,'cem');S.fog.near=14;S.fog.far=42;
  tiers(cx,cy-120);put('shrine_candles',cx,cy-170,1.8,0,0);ofrendaBoard(cx,cy-230,3.6);lamp(cx,cy-60,2.4,20);
  for(let i=0;i<12;i++){const a=Math.PI*.15+i/11*Math.PI*.7,x=cx+Math.cos(a)*240,y=cy-60+Math.sin(a)*170;put('candle_triple',x,y,1.3,a,0);flame(x,y,.5)}
  const GR=['gravestone','grave_A','grave_B','gravemarker_A','gravemarker_B','grave_A_destroyed'];let k=0;
  for(const [x0,y0] of [[300,250],[1850,250],[300,1450],[1850,1450]])for(let r=0;r<4;r++)for(let c=0;c<4;c++){if((r+c+k)%7===3)continue;const x=x0+c*220,y=y0+r*170;put(GR[(k++)%6],x,y,1.7,(rnd()-.5)*.4,32);if(k%4===0){put('candle_melted',x+40,y+30,1.4,0,0);flame(x+40,y+30,.27)}}
  put('crypt',cx-950,cy,2.2,Math.PI/2,120);put('crypt',cx+950,cy,2.2,-Math.PI/2,120);lamp(cx-850,cy,2,9);lamp(cx+850,cy,2,9);
  put('arch_gate',cx,WH-120,2.2,0,0);put('fence_pillar',cx-170,WH-120,2,0,26);put('fence_pillar',cx+170,WH-120,2,0,26);
  for(let x=200;x<WW-200;x+=140)if(Math.abs(x-cx)>260){put('fence',x,WH-120,2,0,0)}
  for(const [x,y,n] of [[150,1200,'tree_dead_large'],[2850,1200,'tree_dead_large_decorated'],[1500,150,'tree_dead_medium'],[700,1250,'tree_dead_medium'],[2300,1150,'tree_dead_large'],[1500,2000,'coffin_decorated'],[1250,1700,'skull_candle'],[1750,1700,'skull_candle']])put(n,x,y,2.2,rnd()*6,30);
  picado([[u(cx-300),u(cy-330),u(cx+300),u(cy-330),3.6]])}};
// ---------- enemies ----------
let RIG={},CLIPS={},headTex=null;const live=new Map();const pool={};
const KIND={chiq:'minion',bail:'rogue',brin:'minion',mari:'mage',gordo:'warrior',s:'minion',b:'warrior'};
function mkEnemy(kind){const src=RIG[kind];const o=SU.clone(src.scene);let head=null;const mats=[];
 o.traverse(m=>{if(m.isBone&&/^head$/i.test(m.name))head=m;if(m.isMesh){m.castShadow=!Q.low;m.frustumCulled=false;m.material=m.material.clone();mats.push(m.material);const n=m.name.toLowerCase();if(/head|jaw|eyes|skull|helmet/.test(n)&&!/hood/.test(n))m.visible=false;if(/hood|cape|cloak/.test(n))m.material.color.setHex(0x1a1420)}});
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:headTex,transparent:true,alphaTest:.3}));sp.scale.set(1.25,1.25*(245/236),1);sp.position.set(0,.35,.15);sp.center.set(.5,.4);(head||o).add(sp);mats.push(sp.material);
 const mix=new THREE.AnimationMixer(o);const act=n=>CLIPS[n]?mix.clipAction(CLIPS[n]):null;const run=act('Running_A')||act('Walking_A');run&&run.play();
 const bx=new THREE.Box3().setFromObject(o);return {o,mix,h0:(bx.max.y-bx.min.y)||2.4,mats}}
function getE(kind){const p=pool[kind]||(pool[kind]=[]);const m=p.pop()||mkEnemy(kind);S.add(m.o);return m}
function relE(kind,m){S.remove(m.o);(pool[kind]||(pool[kind]=[])).push(m)}
// ---------- billboards (depth-tested vertical cards) ----------
const BB=new THREE.Group();S.add(BB);const TILT=1.3;// stretch to counter camera foreshortening
function card(tex,w,h,foot){const g=new THREE.PlaneGeometry(1,1);g.translate(0,.5-(foot||0),0);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.35,side:THREE.DoubleSide}));m.scale.set(w,h*TILT,1);BB.add(m);return m}
const hc=document.createElement('canvas');hc.width=256;hc.height=320;const hg=hc.getContext('2d');const ht=new THREE.CanvasTexture(hc);ht.colorSpace=SRGB;let heroM=null,heroGW=0;
const blobT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const blob=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:blobT,transparent:true,depthWrite:false}));blob.rotation.x=-Math.PI/2;S.add(blob);
const pickTex={};function texFor(key,draw,gw,gh){if(pickTex[key])return pickTex[key];const c=document.createElement('canvas');c.width=160;c.height=Math.round(160*gh/gw);const g=c.getContext('2d');g.scale(160/gw,160/gw);g.translate(gw/2,gh*.9);draw(g);const t=new THREE.CanvasTexture(c);t.colorSpace=SRGB;return pickTex[key]={t,gw,gh}}
const pk=new Map();let chTex=null;const shots=new Map(),eps=new Map(),buds=[];
let coinIM=null;
// ---------- gore (instanced) ----------
const GN=240;let gore=null;
function mkGore(){const bone=new THREE.CapsuleGeometry(.05,.28,2,6);bone.rotateZ(Math.PI/2);const skull=new THREE.IcosahedronGeometry(.11,0);const pet=new THREE.PlaneGeometry(.16,.1);
 const mk=(geo,m)=>{const im=new THREE.InstancedMesh(geo,m,GN);im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);im.frustumCulled=false;S.add(im);return im};
 gore={sets:[{im:mk(bone,new THREE.MeshStandardMaterial({color:0xf4ecd8,roughness:.6})),p:[]},{im:mk(skull,new THREE.MeshStandardMaterial({color:0xf4ecd8,roughness:.5,flatShading:true})),p:[]},{im:mk(pet,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,color:0xffffff})),p:[]}],i:[0,0,0]};
 const c=new THREE.Color();for(let i=0;i<GN;i++){gore.sets[2].im.setColorAt(i,c.setHex([0xff8a00,0xffb703,0xff4fd8,0xffd23f][i%4]));gore.sets[1].im.setColorAt(i,c.setHex(i%5===0?0xff4fd8:i%7===0?0x3be8ff:0xf4ecd8))}
 for(const s of gore.sets){for(let i=0;i<GN;i++){dm.position.set(0,-50,0);dm.scale.setScalar(0);dm.updateMatrix();s.im.setMatrixAt(i,dm.matrix);s.p.push({l:0})}}}
function spawnGore(x,y,h,big){if(!gore)return;const n=big?[22,14,40]:[6,4,10];for(let k=0;k<3;k++)for(let j=0;j<n[k];j++){const s=gore.sets[k],i=gore.i[k]=(gore.i[k]+1)%GN,p=s.p[i];const a=Math.random()*6.283,v=(big?4:2.5)+Math.random()*3;
 Object.assign(p,{x:u(x),y:u(h)+.6+Math.random()*.6,z:u(y),vx:Math.cos(a)*v,vy:3+Math.random()*(big?7:5),vz:Math.sin(a)*v,rx:Math.random()*6,ry:Math.random()*6,wr:(Math.random()-.5)*16,l:k===2?1.6+Math.random():1.4+Math.random()*.8,L:0,g:k===2?3:18})}}
function updGore(dt){if(!gore)return;for(const s of gore.sets){let any=false;for(let i=0;i<GN;i++){const p=s.p[i];if(p.l<=0)continue;any=true;p.l-=dt;p.vy-=p.g*dt;if(p.g<5){p.vx*=.98;p.vz*=.98;p.vy=Math.max(p.vy,-1.2)}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.06){p.y=.06;if(p.vy<-1){p.vy*=-.45;p.vx*=.6;p.vz*=.6}else{p.vy=0;p.vx*=.85;p.vz*=.85;p.wr*=.85}}p.rx+=p.wr*dt;p.ry+=p.wr*.7*dt;
  dm.position.set(p.x,p.y,p.z);dm.rotation.set(p.rx,p.ry,0);dm.scale.setScalar(p.l<=0?0:Math.min(1,p.l/.4));dm.updateMatrix();s.im.setMatrixAt(i,dm.matrix)}if(any||s.dirty){s.im.instanceMatrix.needsUpdate=true;s.dirty=any}}}
// ---------- api ----------
let ready=false,built=0,last=performance.now();const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),ray=new THREE.Raycaster(),gp=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let VW=960,VH=540,fpsN=0,fpsT=0,fps=60,downgraded=false;
function setCam(cx,cy){const tx=u(cx),tz=u(cy);const dist=VH/U*1.35;cam.position.set(tx,dist*Math.sin(.95),tz+dist*Math.cos(.95));cam.lookAt(tx,0,tz);cam.updateMatrixWorld();cam.updateProjectionMatrix()}
function downgrade(){if(downgraded)return;downgraded=true;Q.low=true;R.setPixelRatio(1);moon.castShadow=false;S.traverse(o=>{if(o.isMesh&&o.material){o.castShadow=false}});console.info('[arcade] quality: low (fps '+fps.toFixed(0)+')')}
const G3={get ready(){return ready},TB,Q,get fps(){return fps},
 proj(x,y,h){tmp.set(u(x),u(h||0),u(y)).project(cam);tmp2.set(u(x)+1,u(h||0),u(y)).project(cam);return[(tmp.x+1)/2*VW,(1-tmp.y)/2*VH,Math.hypot((tmp2.x-tmp.x)/2*VW,(tmp2.y-tmp.y)/2*VH)/U]},
 unproj(vx,vy){ray.setFromCamera({x:vx/VW*2-1,y:1-vy/VH*2},cam);const hit=new THREE.Vector3();return ray.ray.intersectPlane(gp,hit)?[hit.x*U,hit.z*U]:null},
 gore:spawnGore,
 frame(st){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;VW=st.W;VH=st.H;
  fpsN++;fpsT+=dt;if(fpsT>=2){fps=fpsN/fpsT;fpsN=0;fpsT=0;if(st.run&&fps<40&&!downgraded&&!window.__noauto)downgrade()}
  const w=innerWidth,h=innerHeight;if(cvs.width!==Math.floor(w*R.getPixelRatio())||cvs.height!==Math.floor(h*R.getPixelRatio()))R.setSize(w,h,false);cam.aspect=w/h;
  setCam(st.cx,st.cy);if(!ready){R.render(S,cam);return}
  const P=st.P;
  if(P){pl.position.set(u(P.x),2.2,u(P.y));moon.position.set(u(P.x)-8,22,u(P.y)+6);moon.target.position.set(u(P.x),0,u(P.y));
   // hero card: redraw the 2D hero (Gabe's art, throw animation) into a canvas texture
   const gw=P.h*1.7,gh=gw*1.25;if(!heroM||heroGW!==gw){if(heroM)BB.remove(heroM);heroM=card(ht,u(gw),u(gh),.08);heroGW=gw}
   const s=256/gw;hg.setTransform(1,0,0,1,0,0);hg.clearRect(0,0,256,320);hg.setTransform(s,0,0,s,128-P.x*s,320*.92-P.y*s);st.drawHero(hg);ht.needsUpdate=true;
   heroM.position.set(u(P.x),0,u(P.y));heroM.visible=st.heroVis;blob.position.set(u(P.x),.02,u(P.y));blob.scale.set(u(P.w)*1.4,u(P.w)*.8,1);blob.visible=true}else blob.visible=false;
  // enemies
  const seen=new Set();for(const e of st.E||[]){const kind=KIND[e.t]||'minion';let m=live.get(e);if(!m){m=getE(kind);m.kind=kind;live.set(e,m)}seen.add(e);
   const big=e.t==='b',hgt=e.r*(big?3.4:3.1)*(e.t==='gordo'?1.1:1);const s=u(hgt)/m.h0,wd=e.t==='gordo'?1.3:big&&e.fin?1.2:1;m.o.scale.set(s*wd,s,s*wd);
   m.o.position.set(u(e.x),u(e.z||0),u(e.y));const tgx=e.charm>0?0:(P.x-e.x),tgy=e.charm>0?1:(P.y-e.y);m.o.rotation.y=Math.atan2(tgx,tgy)+(e.st==='wind'?Math.sin(now/30)*.15:0);
   m.mix.timeScale=e.st==='charge'?2.2:e.t==='gordo'?.6:e.t==='chiq'?1.5:1;m.mix.update(dt);
   const fl=e.fl>0,ch=e.charm>0;for(const mt of m.mats){if(mt.isSpriteMaterial){mt.color.setHex(fl?0xffffff:ch?0xffb0e0:big&&e.fin?0xffe080:0xffffff);continue}mt.emissive&&mt.emissive.setHex(fl?0xffffff:ch?0x661144:big?(e.fin?0x442200:0x220a00):0);mt.emissiveIntensity=fl?.8:1}}
  for(const [e,m] of live)if(!seen.has(e)){live.delete(e);relE(m.kind,m)}
  // pickups
  const pseen=new Set();for(const q of st.U||[]){let m=pk.get(q);if(!m){const key=q.k==='card'?'card_'+q.card:q.k;const gw=q.k==='llama'?200:90,gh=q.k==='llama'?190:100;const tx=texFor(key,g=>st.drawPick(g,{k:q.k,card:q.card,x:0,y:0,b:q.b||0}),gw,gh);m=card(tx.t,u(gw),u(gh),.1);pk.set(q,m)}pseen.add(q);m.position.set(u(q.x),Math.sin(now/300+(q.b||0))*.08,u(q.y))}
  for(const [q,m] of pk)if(!pseen.has(q)){BB.remove(m);pk.delete(q)}
  // coins (instanced)
  if(coinIM){const C=st.C||[];coinIM.count=Math.min(C.length,300);for(let i=0;i<coinIM.count;i++){const c=C[i];dm.position.set(u(c.x),.35+Math.sin(now/160+c.b)*.06,u(c.y));dm.rotation.set(Math.PI/2,0,now/300+c.b);dm.scale.setScalar(1);dm.updateMatrix();coinIM.setMatrixAt(i,dm.matrix)}coinIM.instanceMatrix.needsUpdate=true}
  // chanclas + enemy shots + spinning buddies
  const sseen=new Set();for(const s2 of st.S||[]){let m=shots.get(s2);if(!m){m=new THREE.Sprite(new THREE.SpriteMaterial({map:chTex,transparent:true,alphaTest:.3}));m.scale.set(.85,.85,1);S.add(m);shots.set(s2,m)}sseen.add(s2);m.position.set(u(s2.x),u(P?P.h*.45:50),u(s2.y+(P?P.h/2:50)));m.material.rotation=s2.a;m.material.color.setHex(st.pierce?0xfff6a0:0xffffff)}
  for(const [k,m] of shots)if(!sseen.has(k)){S.remove(m);m.material.dispose();shots.delete(k)}
  const eseen=new Set();for(const q of st.EP||[]){let m=eps.get(q);if(!m){m=new THREE.Mesh(new THREE.IcosahedronGeometry(.16,0),mat(0xff8a00,{emissive:0xff6a00,emissiveIntensity:1.2}));S.add(m);eps.set(q,m)}eseen.add(q);m.position.set(u(q.x),.9,u(q.y+40));m.rotation.y=now/120}
  for(const [k,m] of eps)if(!eseen.has(k)){S.remove(m);m.geometry.dispose();eps.delete(k)}
  const nb=st.bud||[];while(buds.length<nb.length){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:chTex,transparent:true,alphaTest:.3,color:0xffe680}));m.scale.set(1,1,1);S.add(m);buds.push(m)}buds.forEach((m,i)=>{m.visible=i<nb.length;if(m.visible){m.position.set(u(nb[i][0]),1.4,u(nb[i][1]+(P?P.h/2:0)));m.material.rotation=now/100}});
  // ofrenda board
  if(ofBoard&&st.ofKey!==ofKey){ofKey=st.ofKey;const g=ofBoard.c.getContext('2d');g.clearRect(0,0,440,273);st.drawOf(g);ofBoard.t.needsUpdate=true}
  updGore(dt);
  const t=now/1000;for(const f of flagSets){for(let i=0;i<f.data.length;i++){const d=f.data[i];dm.position.set(d.x,d.y,d.z);dm.rotation.set(Math.sin(t*2+d.p)*.35,d.r,0);dm.scale.setScalar(1);dm.updateMatrix();f.im.setMatrixAt(i,dm.matrix)}f.im.instanceMatrix.needsUpdate=true}
  for(let i=0;i<flames.length;i++)flames[i].scale.y=1.6+Math.sin(t*12+i)*.3;
  R.render(S,cam)},
 async init(){try{
  headTex=TL.load('/play/calavera_gabe.webp');headTex.colorSpace=SRGB;headTex.repeat.set(1,245/457);headTex.offset.set(0,1-245/457);
  chTex=TL.load('/s3d/chancla_gold.webp');chTex.colorSpace=SRGB;
  const [pr,mi,ro,ma,wa]=await Promise.all(['props.glb','sk_minion.glb','sk_rogue.glb','sk_mage.glb','sk_warrior.glb'].map(load));
  pr.scene.children.forEach(c=>{PROPS[c.name.replace(/[._]\d+$/,'')]=c});
  RIG={minion:mi,rogue:ro,mage:ma,warrior:wa};for(const c of mi.animations)CLIPS[c.name]=c;
  coinIM=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.2,.05,12),new THREE.MeshStandardMaterial({color:0xffb703,emissive:0xff8a00,emissiveIntensity:.6,metalness:.3,roughness:.4}),300);coinIM.count=0;coinIM.frustumCulled=false;S.add(coinIM);
  mkGore();
  // warm up enemy pool so first wave doesn't hitch
  for(const k of ['minion','rogue','mage','warrior'])relE(k,mkEnemy(k));
  ready=true;if(bar)bar.style.display='none';window.dispatchEvent(new Event('g3ready'))}catch(err){console.warn('3D load failed',err);if(bar)bar.querySelector('b').textContent='3D failed to load — please refresh'}},
 build(WW,WH,lvl){if(!ready)return;if(built===lvl)return;built=lvl;S.remove(LV);LV=new THREE.Group();S.add(LV);TB.length=0;flames=[];flagSets=[];lampN=0;ofBoard=null;
  (LAY[lvl]||LAY[1])(WW,WH);
  for(const [e,m] of live){relE(m.kind,m)}live.clear();
  if(gore)for(const s of gore.sets)for(const p of s.p)p.l=0;
  R.compile(S,cam)}};
window.G3=G3;G3.init();
