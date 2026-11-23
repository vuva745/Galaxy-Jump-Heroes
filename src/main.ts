import * as THREE from 'three';
import { clamp, near2d } from './logic';
import './style.css';
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x171133); scene.fog = new THREE.Fog(0x171133,45,130);
const camera = new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,200);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);document.querySelector('#app')!.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xb7dcff,0x292032,2.1));const sunlight=new THREE.DirectionalLight(0xffffff,2);sunlight.position.set(-10,25,15);scene.add(sunlight);
function cube(w:number,h:number,d:number,color:number,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);scene.add(m);return m;}
function orb(r:number,color:number,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.18}));m.position.set(x,y,z);scene.add(m);return m;}
const player=orb(.85,0xffa326,0,1,0);
const held={up:false,down:false,left:false,right:false,action:false};type Control=keyof typeof held;
for(const id of Object.keys(held) as Control[]){const el=document.getElementById(id)!;const set=(value:boolean)=>(e:Event)=>{e.preventDefault();held[id]=value;el.classList.toggle('active',value)};el.addEventListener('pointerdown',set(true));for(const name of ['pointerup','pointercancel','pointerleave'])el.addEventListener(name,set(false));}
const keymap:Record<string,Control>={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',' ':'action',Enter:'action'};
window.addEventListener('keydown',e=>{const k=keymap[e.key];if(k){e.preventDefault();held[k]=true}});window.addEventListener('keyup',e=>{const k=keymap[e.key];if(k){e.preventDefault();held[k]=false}});window.addEventListener('blur',()=>{for(const k of Object.keys(held) as Control[])held[k]=false});
const hud=document.querySelector<HTMLElement>('#hud')!;const message=document.querySelector<HTMLElement>('#message')!;let ended=false;
function finish(won:boolean,score:number){ended=true;message.hidden=false;message.innerHTML=`<h2>${won?'🏆 YOU WIN':'💥 GAME OVER'}</h2><p>Score: ${score}</p><button id="restart">RESTART</button>`;document.getElementById('restart')!.onclick=()=>location.reload()}
let last=performance.now();function loop(now:number){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(!ended)update(dt);renderer.render(scene,camera)}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const platforms:{x:number,z:number}[]=[];const stars:THREE.Mesh[]=[];for(let i=0;i<22;i++){const z=-i*5.5,x=Math.sin(i*.8)*3.5;platforms.push({x,z});cube(7,.7,5,0x493fa0+(i%3)*0x090500,x,-.35,z);if(i>0)stars.push(orb(.55,0xffe233,x,1.5,z))}
let score=0,vy=0,grounded=true,jumpWasHeld=false;player.position.set(0,1,0);
function update(dt:number){const dx=Number(held.right)-Number(held.left),dz=held.up?-1:held.down?1:-.75;player.position.x+=dx*8*dt;player.position.z+=dz*8*dt;
const onPad=platforms.some(p=>Math.abs(player.position.x-p.x)<=3.5&&Math.abs(player.position.z-p.z)<=2.5);if(grounded&&!onPad)grounded=false;
if(held.action&&!jumpWasHeld&&grounded){vy=10.5;grounded=false}jumpWasHeld=held.action;
if(!grounded){vy-=24*dt;player.position.y+=vy*dt;if(vy<=0&&player.position.y<=1&&onPad){player.position.y=1;vy=0;grounded=true}}
for(let i=stars.length-1;i>=0;i--){const s=stars[i];s.rotation.y+=dt*2;if(s.position.distanceTo(player.position)<1.6){scene.remove(s);stars.splice(i,1);score++}}
if(player.position.y< -12)finish(false,score);if(score>=15)finish(true,score);hud.textContent=`GALAXY JUMP HEROES · Stars ${score}/15`;camera.position.lerp(new THREE.Vector3(player.position.x,player.position.y+10,player.position.z+17),.1);camera.lookAt(player.position.x,player.position.y,player.position.z-6)}
requestAnimationFrame(loop);
