// Chancla Arcade: Day of the Dead lane tower defense (three.js r170).
// Art: Gabe's existing sugar skull kids, older Abuela sprite, chancla, night backdrop; KayKit CC0 skeletons as the calavera horde.
// Everything else (house, yard, slingshots, petals, effects, audio) is drawn in code.
import * as THREE from 'three';
import {GLTFLoader} from '/vendor/three/loaders/GLTFLoader.js';
import * as SU from '/vendor/three/utils/SkeletonUtils.js';

const ROWS=5,COLS=9,T=1.2,X0=-4.8,Z0=-2.4;            // tile size and origin (col 0 / row 0 centers)
const HOUSE_X=-6.2,SPAWN_X=6.6;
const cx=c=>X0+c*T, rz=r=>Z0+r*T;
const $=id=>document.getElementById(id);

// ---------- unit catalog ----------
// Throws are Abuela's slingshot setups; kids are the sugar skull defenders.
const UNITS={
 nino:  {name:'Calaca Boy', cost:50, hp:6,  cd:7, img:'/play/calaca_sprite.webp', tip:'Sugar skull boy. Gathers cempasúchil petals so you can build more.'},
 nina:  {name:'Calavera Girl',cost:50,hp:40,cd:18,img:'/play/calavera_gabe.webp', tip:'Sugar skull girl. Blocks the lane and bonks anything that gets close.'},
 recta: {name:'Straight', cost:100,hp:8, cd:6, col:0xffd23f, rate:1.4, tip:'Straight shot. A fast chancla down the lane.'},
 globo: {name:'Lob',      cost:150,hp:8, cd:10,col:0xff8a00, rate:2.6, tip:'Lob. Arcs over blockers and splashes the landing spot.'},
 abanico:{name:'Spread',  cost:175,hp:8, cd:12,col:0xff4fd8, rate:1.9, tip:'Spread. Three chanclas: its lane and both neighbors.'},
 rebote:{name:'Ricochet', cost:200,hp:8, cd:14,col:0x3be8ff, rate:1.7, tip:'Ricochet. Bounces to two more calaveras.'},
 mareo: {name:'Dizzy',    cost:125,hp:8, cd:9, col:0x7dff5a, rate:2.0, tip:'Dizzy shot. Slows calaveras, and every third throw stuns them.'},
 pala:  {name:'Dig Up',   cost:0, tip:'Dig up. Remove one of your setups (half refund).'}
};
const ORDER=['nino','nina','recta','globo','abanico','rebote','mareo','pala'];
const ZT={ // calavera horde
 minion:{hp:10,spd:.30,dps:1,  sc:.55,tint:0xb8ffb0},
 rogue: {hp:8, spd:.58,dps:1,  sc:.5, tint:0xffd0ff},
 warrior:{hp:30,spd:.24,dps:1.5,sc:.62,tint:0xffe0a0},
 mage:  {hp:70,spd:.19,dps:2.5,sc:.85,tint:0xffa0a0,boss:1}
};
const WAVES=8;
function waveList(n){ // [{t,delay,flank}]
 const L=[];const cnt=3+n*3;
 for(let i=0;i<cnt;i++){let t='minion';const r=Math.random();
  if(n>=2&&r<.18+n*.03)t='rogue';else if(n>=3&&r>.82-n*.03)t='warrior';
  L.push({t,delay:i===0?0:Math.max(.7,(5.2-n*.42)*(.6+Math.random()*.8)),flank:n>=2&&Math.random()<.12+n*.03})}
 if(n===4||n===6)L.push({t:'warrior',delay:1,flank:false},{t:'warrior',delay:.8,flank:false});
 if(n===WAVES)L.push({t:'mage',delay:2,flank:false});
 return L}

// ---------- renderer / scene ----------
const cv=$('c');
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));
R.outputColorSpace=THREE.SRGBColorSpace;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
const S=new THREE.Scene();S.fog=new THREE.Fog(0x1a0833,16,34);
const cam=new THREE.PerspectiveCamera(40,1,.1,100);
const TL=new THREE.TextureLoader();const tex=u=>{const t=TL.load(u);t.colorSpace=THREE.SRGBColorSpace;return t};
const bg=tex('/play/night_bg.webp');S.background=bg;
S.add(new THREE.HemisphereLight(0xb9a0ff,0x2a1040,1.1));
const sun=new THREE.DirectionalLight(0xffe2b0,1.6);sun.position.set(-4,10,6);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-9,right:9,top:6,bottom:-6});sun.shadow.mapSize.set(1024,1024);S.add(sun);
const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.8,...o});

// yard
const yard=new THREE.Group();S.add(yard);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,16),mat(0x241238));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;yard.add(ground);
const tileG=new THREE.BoxGeometry(T*.97,.08,T*.97);
const tiles=[];
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const m=new THREE.Mesh(tileG,mat((r+c)%2?0x4a2a7a:0x3c2066));m.position.set(cx(c),0,rz(r));m.receiveShadow=true;yard.add(m);tiles.push(m)}
// marigold border rows (code drawn)
const mgG=new THREE.SphereGeometry(.13,8,6),mgM=mat(0xff9a00,{emissive:0xff6a00,emissiveIntensity:.35});
const mgI=new THREE.InstancedMesh(mgG,mgM,80);let mi=0;const dm=new THREE.Object3D();
for(const z of [Z0-T*.75,Z0+ROWS*T-T*.25])for(let i=0;i<40&&mi<80;i++){dm.position.set(X0-T*.5+i*.28,.1,z+(Math.random()-.5)*.15);dm.scale.setScalar(.8+Math.random()*.5);dm.updateMatrix();mgI.setMatrixAt(mi++,dm.matrix)}
yard.add(mgI);
// candles along the far edge
const flames=[];for(let i=0;i<8;i++){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.3,8),mat(0xfff3d6));c.position.y=.15;const f=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,8),new THREE.MeshBasicMaterial({color:0xffb703}));f.position.y=.37;g.add(c,f);g.position.set(X0+i*1.4,0,Z0-T*1.05);yard.add(g);flames.push(f)}
const glow=new THREE.PointLight(0xff9a3c,6,9,1.6);glow.position.set(0,1.2,Z0-1.4);S.add(glow);

// Abuela's house (code drawn)
const house=new THREE.Group();S.add(house);
{const w=new THREE.Mesh(new THREE.BoxGeometry(1.8,2.2,ROWS*T+.6),mat(0xe8a0c8));w.position.set(HOUSE_X-.4,1.1,0);w.castShadow=true;house.add(w);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,ROWS*T+.9),mat(0xc0392b));roof.rotation.z=Math.PI/4;roof.scale.y=.6;roof.position.set(HOUSE_X-.4,2.2,0);roof.castShadow=true;house.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.05,1.1,.7),mat(0x6b3410));door.position.set(HOUSE_X+.52,.55,0);house.add(door);
 for(const z of [-1.8,1.8]){const wi=new THREE.Mesh(new THREE.BoxGeometry(.05,.55,.6),new THREE.MeshStandardMaterial({color:0xffd23f,emissive:0xffb703,emissiveIntensity:.8}));wi.position.set(HOUSE_X+.52,1.35,z);house.add(wi)}
 // papel picado string
 const cols=[0xff4fd8,0xffd23f,0x3be8ff,0x7dff5a,0xff8a00,0xb46bff];
 for(let i=0;i<10;i++){const f=new THREE.Mesh(new THREE.PlaneGeometry(.42,.32),new THREE.MeshStandardMaterial({color:cols[i%6],side:THREE.DoubleSide,emissive:cols[i%6],emissiveIntensity:.25}));f.position.set(HOUSE_X+.6,2.05-.12*Math.sin(i/9*Math.PI),-3.1+i*.69);f.rotation.y=Math.PI/2;house.add(f)}}
const abuela=new THREE.Sprite(new THREE.SpriteMaterial({map:tex('/play/abuela_sprite.webp'),transparent:true,alphaTest:.2}));
abuela.center.set(.5,0);abuela.scale.set(1.3*387/512,1.3,1);abuela.position.set(HOUSE_X+.95,.02,-3.25);S.add(abuela);

// highlight cursor
const hl=new THREE.Mesh(new THREE.BoxGeometry(T,.1,T),new THREE.MeshBasicMaterial({color:0xffd23f,transparent:true,opacity:.35}));hl.visible=false;S.add(hl);

// ---------- textures ----------
const chTex=tex('/play/t_chancla.webp');
const kidTex={nino:tex('/play/calaca_sprite.webp'),nina:tex('/play/calavera_gabe.webp')};
const kidAsp={nino:225/472,nina:236/457};
function dotTex(color){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
 const gr=g.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'#fff');gr.addColorStop(.35,color);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function petalTex(){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.translate(48,48);
 for(let k=0;k<3;k++){g.fillStyle=['#ff7a00','#ff9a00','#ffc23a'][k];const n=12-k*3,rad=40-k*12;for(let i=0;i<n;i++){g.save();g.rotate(i/n*Math.PI*2+k*.3);g.beginPath();g.ellipse(rad*.55,0,rad*.5,rad*.22,0,0,Math.PI*2);g.fill();g.restore()}}
 g.fillStyle='#7a3b00';g.beginPath();g.arc(0,0,6,0,7);g.fill();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const pTex=petalTex();const sparkTex=dotTex('#ffd23f');const starTex=dotTex('#7dff5a');

// ---------- skeleton rigs ----------
const RIG={};const CLIPS={};let rigsOK=false;
const gl=new GLTFLoader();
const loadG=u=>new Promise((a,b)=>gl.load('/arcade3d/'+u,a,undefined,b));
const ready=Promise.all(['sk_minion.glb','sk_rogue.glb','sk_warrior.glb','sk_mage.glb'].map(loadG)).then(([mi,ro,wa,ma])=>{
 Object.assign(RIG,{minion:mi,rogue:ro,warrior:wa,mage:ma});for(const c of mi.animations)CLIPS[c.name]=c;rigsOK=true}).catch(e=>console.warn('rigs failed, using simple calaveras',e));
function mkZombieMesh(kind){const z=ZT[kind];
 if(rigsOK){const o=SU.clone(RIG[kind].scene);const mats=[];o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.frustumCulled=false;m.material=m.material.clone();m.material.color.multiply(new THREE.Color(z.tint));mats.push(m.material)}});
  o.scale.setScalar(z.sc);const mix=new THREE.AnimationMixer(o);const cl=CLIPS['Walking_A']||CLIPS['Running_A']||Object.values(CLIPS)[0];const walk=cl?mix.clipAction(cl):null;walk&&walk.play();
  const atk=CLIPS['1H_Melee_Attack_Chop']||CLIPS['Unarmed_Melee_Attack_Punch_A'];const atkA=atk?mix.clipAction(atk):null;
  const g=new THREE.Group();o.rotation.y=-Math.PI/2;g.add(o);return {g,mix,walk,atkA,mats}}
 const g=new THREE.Group();const m=mat(0xeeeeee);const b=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.5,4,8),m);b.position.y=.5;const h=new THREE.Mesh(new THREE.SphereGeometry(.24,12,10),m);h.position.y=1.05;b.castShadow=h.castShadow=true;g.add(b,h);g.scale.setScalar(z.sc/.55);return {g,mix:null,mats:[m]}}

// ---------- state ----------
let G;
function reset(){
 for(const u of G?.units||[])S.remove(u.o);for(const z of G?.zs||[])S.remove(z.m.g);for(const p of G?.ps||[])S.remove(p.o);for(const f of G?.fx||[])S.remove(f.o);for(const m of G?.mow||[])m&&S.remove(m);
 G={petals:200,wave:0,house:5,grid:Array.from({length:ROWS},()=>Array(COLS).fill(null)),units:[],zs:[],ps:[],fx:[],queue:[],qt:0,waveT:14,between:true,sel:null,cool:{},over:false,paused:false,t:0,kills:0,lane:Array(ROWS).fill(true),mow:[],skyT:6};
 for(let r=0;r<ROWS;r++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:chTex,transparent:true,alphaTest:.3,color:0xffe680}));s.scale.set(.7,.7,1);s.position.set(HOUSE_X+.85,.35,rz(r));S.add(s);G.mow[r]=s}
 updHud();buildTray();say('Get ready!',1.6)}

// ---------- UI ----------
const tray=$('tray');const cards={};
function buildTray(){tray.innerHTML='';for(const k of ORDER){const u=UNITS[k];const d=document.createElement('div');d.className='card';
 const ic=u.img?`<img src="${u.img}" alt="">`:k==='pala'?`<span style="font-size:28px">⛏</span>`:`<img src="/play/t_chancla.webp" alt="" style="transform:rotate(${{recta:0,globo:-20,abanico:15,rebote:30,mareo:-10}[k]}deg)">`;
 const bgc=u.col?'#'+u.col.toString(16).padStart(6,'0')+'55':'#ffffff18';
 d.innerHTML=`<div class="ic" style="background:${bgc}">${ic}</div>${u.name}<span class="c">${u.cost||'—'}</span><div class="cd"></div>`;
 d.onclick=()=>{sfx('tick');G.sel=G.sel===k?null:k;tipFor()};cards[k]=d;tray.appendChild(d)}}
function tipFor(){const k=G.sel;$('tip').textContent=k?UNITS[k].tip:'Pick a card, then tap a tile on the yard.';$('tip').style.display='block'}
function updTray(){for(const k of ORDER){const d=cards[k];if(!d)continue;const u=UNITS[k];const cd=G.cool[k]||0;d.classList.toggle('sel',G.sel===k);d.classList.toggle('poor',G.petals<u.cost||cd>0);d.lastChild.style.height=cd>0?(cd/u.cd*100)+'%':'0'}}
function updHud(){$('pet').textContent=G.petals;$('wv').textContent=G.wave;$('wmax').textContent=WAVES;$('hh').textContent='♥'.repeat(Math.max(0,G.house))+'♡'.repeat(Math.max(0,5-G.house))}
let msgT=0;function say(t,d=1.4){const m=$('msg');m.textContent=t;m.classList.add('on');msgT=d}

// ---------- audio (synth only) ----------
let AC=null;function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(f,d,type='square',v=.05,slide=0){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,a.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),a.currentTime+d);g.gain.setValueAtTime(v,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+d)}
let lastS={};function sfx(k){const n=performance.now();if(lastS[k]&&n-lastS[k]<60)return;lastS[k]=n;
 ({tick:()=>tone(900,.05,'square',.03),place:()=>{tone(300,.08,'triangle',.08);tone(450,.1,'triangle',.06)},throw:()=>tone(520,.09,'sawtooth',.025,.5),
  hit:()=>tone(160,.08,'square',.05,.6),die:()=>tone(240,.25,'triangle',.07,.3),petal:()=>{tone(880,.08,'sine',.05);setTimeout(()=>tone(1320,.1,'sine',.05),70)},
  bite:()=>tone(90,.07,'sawtooth',.03),house:()=>tone(70,.4,'sawtooth',.1,.5),wave:()=>{tone(392,.15,'square',.05);setTimeout(()=>tone(523,.2,'square',.05),150)},
  mow:()=>tone(200,.6,'sawtooth',.06,3),win:()=>[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.22,'square',.06),i*140)),lose:()=>[392,330,262,196].forEach((f,i)=>setTimeout(()=>tone(f,.3,'triangle',.07),i*180))}[k]||(()=>{}))()}

// ---------- placement ----------
function mkSling(k){const u=UNITS[k];const g=new THREE.Group();const wood=mat(0x7a4a1e);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,.12,12),mat(u.col,{emissive:u.col,emissiveIntensity:.25}));base.position.y=.1;
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.55,8),wood);post.position.y=.42;
 const a1=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.38,8),wood);a1.position.set(0,.8,-.13);a1.rotation.x=-.45;
 const a2=a1.clone();a2.position.z=.13;a2.rotation.x=.45;
 const band=new THREE.Mesh(new THREE.TorusGeometry(.17,.025,6,16,Math.PI),mat(0x3a1a10));band.rotation.set(0,Math.PI/2,Math.PI);band.position.set(-.05,.96,0);
 const ch=new THREE.Sprite(new THREE.SpriteMaterial({map:chTex,transparent:true,alphaTest:.3}));ch.scale.set(.42,.42,1);ch.position.set(-.12,.95,0);
 for(const m of [base,post,a1,a2])m.castShadow=true;g.add(base,post,a1,a2,band,ch);g.userData.ch=ch;
 const pip=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),new THREE.MeshBasicMaterial({color:u.col}));pip.position.set(0,1.25,0);g.add(pip);return g}
function mkKid(k){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:kidTex[k],transparent:true,alphaTest:.25}));s.center.set(.5,0);const h=k==='nina'?1.5:1.45;s.scale.set(h*kidAsp[k],h,1);const g=new THREE.Group();g.add(s);g.userData.s=s;return g}
function place(r,c){const k=G.sel;if(!k)return;
 if(k==='pala'){const u=G.grid[r][c];if(u){G.petals+=Math.floor(UNITS[u.k].cost/2);killUnit(u);sfx('place');updHud()}return}
 const u=UNITS[k];if(G.grid[r][c]){say('Tile taken',.8);return}if(G.petals<u.cost){say('Need more petals',.9);return}if((G.cool[k]||0)>0){say('Recharging…',.8);return}
 const o=k==='nino'||k==='nina'?mkKid(k):mkSling(k);o.position.set(cx(c),.04,rz(r));S.add(o);
 const unit={k,r,c,o,hp:u.hp,max:u.hp,t:k==='nino'?3:.4,shots:0,fl:0};G.grid[r][c]=unit;G.units.push(unit);
 G.petals-=u.cost;G.cool[k]=u.cd;sfx('place');updHud();G.sel=null;tipFor()}
function killUnit(u){S.remove(u.o);G.grid[u.r][u.c]=null;G.units.splice(G.units.indexOf(u),1)}

// ---------- zombies ----------
function spawn(t,flank){const z=ZT[t];const m=mkZombieMesh(t);const r=Math.floor(Math.random()*ROWS);
 const e={t,r,hp:z.hp*(1+G.wave*.05),max:0,x:SPAWN_X+Math.random()*.6,z:rz(r),m,slow:0,stun:0,fl:0,eating:null,flank:false};e.max=e.hp;
 if(flank){e.flank=true;e.x=cx(3+Math.floor(Math.random()*5));e.z=Math.random()<.5?Z0-2.6:Z0+ROWS*T+1.4;e.r=e.z<0?0:ROWS-1}
 m.g.position.set(e.x,0,e.z);S.add(m.g);G.zs.push(e)}
function hurt(e,d,opt={}){if(e.hp<=0)return;e.hp-=d;e.fl=.12;if(opt.slow)e.slow=Math.max(e.slow,opt.slow);if(opt.stun)e.stun=Math.max(e.stun,opt.stun);sfx('hit');
 if(e.hp<=0){e.dead=.6;sfx('die');G.kills++;burst(e.x,.8,e.z,0xffd23f,8)}}
function firstInLane(r,x,dir=1){let best=null;for(const e of G.zs){if(e.hp<=0||e.r!==r||e.flank)continue;if(e.x>x-.2&&e.x<SPAWN_X+.5&&(!best||e.x<best.x))best=e}return best}

// ---------- projectiles ----------
function shoot(u,opts){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:chTex,transparent:true,alphaTest:.3,color:opts.tint||0xffffff}));s.scale.set(.42,.42,1);
 const p={o:s,x:cx(u.c)+.1,y:.95,z:rz(u.r),vx:opts.vx||5.5,vz:opts.vz||0,r:u.r,dmg:opts.dmg,kind:opts.kind,life:3,hit:new Set(),bounces:opts.bounces||0,...opts};
 s.position.set(p.x,p.y,p.z);S.add(s);G.ps.push(p);sfx('throw');
 const ch=u.o.userData.ch;if(ch){ch.visible=false;setTimeout(()=>ch.visible=true,250)}}
function fire(u){const k=u.k,r=u.r,x=cx(u.c);
 if(k==='recta'){if(!firstInLane(r,x))return false;shoot(u,{dmg:2,kind:'line'});return true}
 if(k==='mareo'){if(!firstInLane(r,x))return false;u.shots++;shoot(u,{dmg:1,kind:'line',vx:4.5,slow:3,stun:u.shots%3===0?1.3:0,tint:0xb8ff9a});return true}
 if(k==='rebote'){if(!firstInLane(r,x))return false;shoot(u,{dmg:2.2,kind:'line',bounces:2,tint:0xa8f4ff});return true}
 if(k==='abanico'){let any=false;for(const d of [-1,0,1]){const rr=r+d;if(rr>=0&&rr<ROWS&&firstInLane(rr,x))any=true}if(!any)return false;
  for(const d of [-1,0,1]){const rr=r+d;if(rr<0||rr>=ROWS)continue;shoot(u,{dmg:1.6,kind:'line',vz:d*T*1.4,r:-1,tint:0xffc0f0,tz:rz(rr),tr:rr})}return true}
 if(k==='globo'){const e=firstInLane(r,x);if(!e)return false;const tx=e.x-ZT[e.t].spd*1.1,dist=tx-x,dur=1.1;
  shoot(u,{dmg:3.2,kind:'lob',sx:x,tx,dur,age:0,vx:dist/dur,tint:0xffc080});return true}
 return false}
function stepP(p,dt){p.life-=dt;if(p.kind==='lob'){p.age+=dt;const k=p.age/p.dur;p.x=p.sx+(p.tx-p.sx)*k;p.y=.95+Math.sin(Math.PI*k)*2.4;p.o.position.set(p.x,p.y,p.z);p.o.material.rotation+=dt*12;
  if(k>=1){for(const e of G.zs)if(e.hp>0&&Math.abs(e.x-p.x)<1&&Math.abs(e.z-p.z)<.8)hurt(e,p.dmg);burst(p.x,.2,p.z,0xff8a00,12);ring(p.x,p.z,0xff8a00);return false}return true}
 p.x+=p.vx*dt;if(p.tz!=null){const dz=p.tz-p.z;p.z+=Math.sign(dz)*Math.min(Math.abs(dz),Math.abs(p.vz)*dt);if(Math.abs(dz)<.02)p.r=p.tr}else p.z+=p.vz*dt;
 p.o.position.set(p.x,p.y,p.z);p.o.material.rotation-=dt*14;if(p.x>SPAWN_X+1||p.life<=0)return false;
 for(const e of G.zs){if(e.hp<=0||p.hit.has(e))continue;if(Math.abs(e.x-p.x)<.35&&Math.abs(e.z-p.z)<.45){p.hit.add(e);hurt(e,p.dmg,{slow:p.slow,stun:p.stun});
  if(p.stun)starFx(e);
  if(p.bounces>0){let nb=null,bd=1e9;for(const o of G.zs){if(o.hp<=0||p.hit.has(o))continue;const d=(o.x-p.x)**2+(o.z-p.z)**2;if(d<bd&&d<9){bd=d;nb=o}}
   if(nb){p.bounces--;const dx=nb.x-p.x,dz=nb.z-p.z,l=Math.hypot(dx,dz)||1;p.vx=dx/l*6;p.vz=dz/l*6;p.tz=null;p.life=1.2;burst(p.x,p.y,p.z,0x3be8ff,5);return true}}
  burst(p.x,p.y,p.z,0xffd23f,4);return false}}
 return true}

// ---------- effects (code only, no confetti) ----------
function burst(x,y,z,col,n){for(let i=0;i<n;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkTex,color:col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(.25);s.position.set(x,y,z);S.add(s);
 G.fx.push({o:s,vx:(Math.random()-.5)*3,vy:Math.random()*2.5,vz:(Math.random()-.5)*3,life:.45,max:.45})}}
function ring(x,z,col){const m=new THREE.Mesh(new THREE.RingGeometry(.3,.42,24),new THREE.MeshBasicMaterial({color:col,transparent:true,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.1,z);S.add(m);G.fx.push({o:m,grow:4,life:.4,max:.4})}
function starFx(e){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:starTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(.5);s.position.set(e.x,1.4,e.z);S.add(s);G.fx.push({o:s,follow:e,life:1.2,max:1.2})}
function petalDrop(x,z,amt,auto){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:pTex,transparent:true,depthWrite:false}));s.scale.setScalar(.6);s.position.set(x,auto?2.5:1.2,z);S.add(s);
 G.fx.push({o:s,petal:amt,life:7,max:7,vy:auto?-.8:0,floor:.5})}

// ---------- input ----------
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
function pick(ev){const b=cv.getBoundingClientRect();ndc.set((ev.clientX-b.left)/b.width*2-1,-((ev.clientY-b.top)/b.height)*2+1);ray.setFromCamera(ndc,cam);return ray}
cv.addEventListener('pointermove',ev=>{if(!G||!G.sel){hl.visible=false;return}const rr=pick(ev);if(rr.ray.intersectPlane(plane,hit)){const c=Math.round((hit.x-X0)/T),r=Math.round((hit.z-Z0)/T);hl.visible=c>=0&&c<COLS&&r>=0&&r<ROWS;hl.position.set(cx(c),.05,rz(r))}});
cv.addEventListener('pointerdown',ev=>{if(!G||G.over||G.paused)return;ac();const rr=pick(ev);
 // petals first
 const ps=G.fx.filter(f=>f.petal);if(ps.length){const hits=rr.intersectObjects(ps.map(f=>f.o));if(hits.length){const f=ps.find(f=>f.o===hits[0].object);collect(f);return}}
 if(rr.ray.intersectPlane(plane,hit)){const c=Math.round((hit.x-X0)/T),r=Math.round((hit.z-Z0)/T);if(c>=0&&c<COLS&&r>=0&&r<ROWS)place(r,c)}});
function collect(f){if(!f.petal)return;G.petals+=f.petal;f.petal=0;f.life=Math.min(f.life,.35);f.max=.35;f.fly=1;sfx('petal');updHud()}
addEventListener('keydown',e=>{if(!G)return;const i='12345678'.indexOf(e.key);if(i>=0){G.sel=ORDER[i];tipFor()}if(e.key==='Escape'){G.sel=null;tipFor()}if(e.key==='p')togglePause()});
function togglePause(){if(!G||G.over)return;G.paused=!G.paused;$('pause').textContent=G.paused?'▶':'II';say(G.paused?'Paused':'',G.paused?1e9:.01)}
$('pause').onclick=togglePause;

// ---------- camera fit ----------
function fit(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;
 const portrait=h/w>1.15;cam.fov=portrait?50:38;const vh=2*Math.tan(cam.fov*Math.PI/360);
 if(portrait){ // lanes run top to bottom: calaveras come down from the top, the house sits at the bottom
  const d=Math.max(9,9/(vh*cam.aspect)*1.05,17.5/vh*.92);cam.up.set(0,1,0);cam.position.set(-1.2-d*.45,d*.9,.35);cam.lookAt(-.9,0,.35)}
 else{const d=Math.max(10,14.5/(vh*cam.aspect)*1.02,9.5/vh);cam.up.set(0,1,0);cam.position.set(-.4,d*.78,d*.62+.4);cam.lookAt(-.4,0,.35)}
 S.fog.near=cam.position.length()+4;S.fog.far=S.fog.near+20;cam.updateProjectionMatrix()}
addEventListener('resize',fit);fit();

// ---------- loop ----------
let last=performance.now();
function step(dt){G.t+=dt;
 for(const k in G.cool)G.cool[k]=Math.max(0,G.cool[k]-dt);
 // falling petals from the night sky
 G.skyT-=dt;if(G.skyT<=0){G.skyT=9+Math.random()*4;petalDrop(cx(Math.floor(Math.random()*COLS)),rz(Math.floor(Math.random()*ROWS)),25,true)}
 // waves
 if(G.between){G.waveT-=dt;if(G.waveT<=0){G.wave++;G.between=false;G.queue=waveList(G.wave);G.qt=0;say(G.wave===WAVES?'Final wave!':'Wave '+G.wave,1.6);sfx('wave');updHud()}}
 else{if(G.queue.length){G.qt-=dt;if(G.qt<=0){const q=G.queue.shift();spawn(q.t,q.flank);G.qt=G.queue[0]?G.queue[0].delay:0}}
  else if(!G.zs.length){if(G.wave>=WAVES){end(true);return}G.between=true;G.waveT=9;say('Wave cleared!',1.4)}}
 // units
 for(const u of [...G.units]){u.t-=dt;u.fl=Math.max(0,u.fl-dt);
  if(u.k==='nino'){if(u.t<=0){u.t=11;petalDrop(cx(u.c),rz(u.r)+.01,25,false)}}
  else if(u.k==='nina'){if(u.t<=0){const e=G.zs.find(e=>e.hp>0&&e.r===u.r&&!e.flank&&e.x>cx(u.c)-.2&&e.x-cx(u.c)<.9);if(e){hurt(e,1);u.t=1;u.o.userData.s.position.x=.15;setTimeout(()=>u.o.userData.s.position.x=0,120)}else u.t=.2}}
  else if(u.t<=0){u.t=fire(u)?UNITS[u.k].rate:.15}
  const s=u.o.userData.s;if(s)s.material.color.setHex(u.fl>0?0xff6666:0xffffff)}
 // zombies
 for(const e of [...G.zs]){
  if(e.dead!=null){e.dead-=dt;e.m.g.rotation.z=Math.min(1.4,(.6-e.dead)*4);e.m.g.position.y-=dt*.4;if(e.dead<=0){S.remove(e.m.g);G.zs.splice(G.zs.indexOf(e),1)}continue}
  e.fl=Math.max(0,e.fl-dt);e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);
  const z=ZT[e.t];const sp=z.spd*(e.slow>0?.5:1)*(e.stun>0?0:1);
  if(e.flank){const tz=rz(e.r);const dz=tz-e.z;e.z+=Math.sign(dz)*Math.min(Math.abs(dz),sp*1.4*dt);e.m.g.rotation.y=dz>0?-Math.PI/2:Math.PI/2;if(Math.abs(dz)<.02){e.flank=false;e.m.g.rotation.y=0}}
  else{const c=Math.round((e.x-X0)/T);const u=c>=0&&c<COLS?G.grid[e.r][c]:null;
   if(u&&Math.abs(e.x-cx(c))<.55){if(e.stun<=0){u.hp-=z.dps*dt;u.fl=.1;sfx('bite');if(u.hp<=0)killUnit(u)}e.eat=1}
   else{e.eat=0;e.x-=sp*dt}
   if(e.x<X0-T*.6){ // reached the porch
    if(G.lane[e.r]){G.lane[e.r]=false;mowLane(e.r)}
    else if(e.x<HOUSE_X+.6){G.house-=z.boss?3:1;sfx('house');say('The house got hit!',1);S.remove(e.m.g);G.zs.splice(G.zs.indexOf(e),1);updHud();if(G.house<=0){end(false);return}continue}}}
  e.m.g.position.set(e.x,0,e.z);if(e.m.mix){e.m.mix.timeScale=e.stun>0?0:e.slow>0?.5:1;e.m.mix.update(dt)}
  for(const m of e.m.mats){m.emissive&&m.emissive.setHex(e.fl>0?0xffffff:e.stun>0?0x225511:e.slow>0?0x113311:0)}}
 // projectiles
 G.ps=G.ps.filter(p=>{const k=stepP(p,dt);if(!k)S.remove(p.o);return k});
 // mowers (Abuela's emergency chancla)
 for(const m of G.mow)if(m&&m.userData.go){m.position.x+=dt*9;m.material.rotation-=dt*20;for(const e of G.zs)if(e.hp>0&&e.r===m.userData.r&&Math.abs(e.x-m.position.x)<.5)hurt(e,999);if(m.position.x>SPAWN_X+1){S.remove(m);G.mow[m.userData.r]=null}}
 // fx
 G.fx=G.fx.filter(f=>{f.life-=dt;const o=f.o;
  if(f.petal!=null){if(f.fly){o.position.lerp(new THREE.Vector3(cam.position.x-3,cam.position.y,cam.position.z),dt*4)}else if(o.position.y>f.floor){o.position.y+=f.vy*dt}else if(f.vy===0){o.position.y=f.floor+Math.sin(G.t*3)*.05}
   o.material.rotation+=dt;if(f.petal&&f.life<1)collect(f)} // auto collect before it fades
  else if(f.grow){o.scale.setScalar(1+(1-f.life/f.max)*f.grow);o.material.opacity=f.life/f.max}
  else if(f.follow){o.position.set(f.follow.x,1.4+Math.sin(G.t*8)*.05,f.follow.z);o.material.rotation+=dt*6;if(f.follow.stun<=0)f.life=0}
  else{o.position.x+=f.vx*dt;o.position.y+=f.vy*dt;o.position.z+=f.vz*dt;f.vy-=6*dt;o.material.opacity=f.life/f.max}
  if(f.life<=0){S.remove(o);return false}return true});
}
function mowLane(r){const m=G.mow[r];if(!m)return;m.userData={go:1,r};m.scale.set(1.1,1.1,1);sfx('mow');say('¡Chanclazo!',1)}
function end(win){G.over=true;$('msg').classList.remove('on');sfx(win?'win':'lose');setTimeout(()=>{$('endt').textContent=win?'¡Ganaste!':'¡Ay, no!';
 $('endp').textContent=win?`Abuela's house is safe! Calaveras stopped: ${G.kills}. Hearts left: ${G.house}.`:`The calaveras got into Abuela's house on wave ${G.wave} of ${WAVES}. Calaveras stopped: ${G.kills}. Try a new mix of throws!`;
 $('end').classList.remove('hide')},700)}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;
 if(G&&!G.over&&!G.paused){step(dt);updTray();if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').classList.remove('on')}}
 for(let i=0;i<flames.length;i++)flames[i].scale.y=1+Math.sin(now/90+i)*.25;
 R.render(S,cam);requestAnimationFrame(frame)}
requestAnimationFrame(frame);

// ---------- boot ----------
ready.finally(()=>{$('ld').textContent='';});
$('go').onclick=()=>{ac();$('start').classList.add('hide');reset()};
$('again').onclick=()=>{$('end').classList.add('hide');reset()};
// test hooks
window.TD={get G(){return G},tileXY:(r,c)=>{const v=new THREE.Vector3(cx(c),0,rz(r)).project(cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]},place:(k,r,c)=>{G.sel=k;place(r,c)},spawn,fast:n=>{for(let i=0;i<n;i++)if(G&&!G.over)step(.05)},UNITS};
