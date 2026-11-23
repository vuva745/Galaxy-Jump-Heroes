import * as THREE from 'three';
import { clamp, near2d } from './logic';
import { showResults } from './leaderboard';
import { Particles, Shake, box, flash, formatTime, glow, makeCanvasTexture, makeStars, mesh, rand, std } from './fx';
import { createPipeline, createRenderer } from './postfx';
import { loadModel, recolor, swapModel } from './models';
import { sfx } from './audio';
import { bindMute, createInput, pulse, setBar, waitForStart } from './screen';
import './style.css';

const TOTAL = 15;

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070418);
scene.fog = new THREE.FogExp2(0x0b0624, 0.0045);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 10, 15);
const renderer = createRenderer();
document.querySelector('#app')!.appendChild(renderer.domElement);
const pipeline = createPipeline(renderer, scene, camera, { bloom: 0.9, threshold: 0.6, radius: 0.5 });

scene.add(new THREE.HemisphereLight(0x6a7bff, 0x1a0f3a, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(20, 40, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
scene.add(makeStars(2200, 320, 1.4, 0xffffff));
scene.add(makeStars(300, 300, 2.6, 0xaad4ff));
scene.add(makeStars(200, 280, 2.2, 0xffd0a8));

// Nebula planes
const nebulaTex = makeCanvasTexture(256, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.3, 'rgba(200,120,255,0.55)');
  g.addColorStop(0.7, 'rgba(70,40,160,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});
for (const [x, y, z, size, color] of [[-80, 30, -260, 220, 0xb46bff], [90, -10, -300, 260, 0x4b7bff], [10, 60, -340, 200, 0xff6bb5], [-40, -40, -220, 150, 0x53e0ff]] as const) {
  const plane = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: nebulaTex, color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), scene, x, y, z, false);
  plane.lookAt(camera.position);
}

// Planets
function planetTexture(a: string, b: string, c: string): THREE.CanvasTexture {
  return makeCanvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    for (let i = 0; i <= 10; i++) g.addColorStop(i / 10, [a, b, c][i % 3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand(0.03, 0.12)})`;
      ctx.fillRect(0, rand(0, s), s, rand(2, 14));
    }
  });
}
const planetMat = (tex: THREE.CanvasTexture, emissive: number) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, emissive, emissiveIntensity: 0.25, fog: false });
const bigPlanet = mesh(new THREE.SphereGeometry(22, 48, 32), planetMat(planetTexture('#5b3fd6', '#8a5cff', '#3d2b9e'), 0x2a1a6e), scene, -70, 18, -170, false);
const ringTex = makeCanvasTexture(256, (ctx, s) => {
  for (let i = 0; i < s; i += 3) {
    ctx.fillStyle = `rgba(220,200,255,${rand(0.1, 0.8)})`;
    ctx.fillRect(i, 0, 3, s);
  }
});
const planetRing = mesh(new THREE.RingGeometry(28, 42, 64), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: false }), bigPlanet, 0, 0, 0, false);
planetRing.rotation.x = Math.PI / 2.4;
planetRing.rotation.y = 0.3;
mesh(new THREE.SphereGeometry(10, 40, 28), planetMat(planetTexture('#ff9a3d', '#ffc46b', '#d85f1c'), 0x7a3a10), scene, 85, 40, -230, false);
const moonlet = mesh(new THREE.SphereGeometry(4.5, 32, 24), planetMat(planetTexture('#4fd6c8', '#8af0e4', '#2a9a90'), 0x0f4a44), scene, 45, -12, -110, false);

// ---------- Platforms & stars ----------
interface Platform { group: THREE.Group; x: number; z: number; w: number; baseX: number; moving: boolean; phase: number; prevX: number }
const platforms: Platform[] = [];
const edgeMat = new THREE.LineBasicMaterial({ color: 0x9ad8ff });
const hues = [0x5a4de0, 0x3f8ee8, 0x7b3fe8, 0x2fc6d8];
for (let i = 0; i < 22; i++) {
  const z = -i * 5.5, x = Math.sin(i * 0.8) * 3.5;
  const small = i > 2 && i % 7 === 3;
  const moving = i > 3 && i % 5 === 4;
  const w = small ? 4.2 : 7;
  const group = new THREE.Group();
  const color = hues[i % hues.length];
  const top = box(w, 0.7, 5, std(color, { metalness: 0.45, roughness: 0.45 }), group, 0, -0.35, 0);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry), edgeMat);
  edges.position.copy(top.position);
  group.add(edges);
  box(w - 0.8, 0.25, 4.2, glow(moving ? 0xffb84d : 0x53e0ff, 2.2), group, 0, -0.82, 0, false);
  if (moving) for (const tx of [-w / 3, w / 3]) mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.5, 10), glow(0xffb84d, 3), group, tx, -1.1, 0, false);
  group.position.set(x, 0, z);
  scene.add(group);
  platforms.push({ group, x, z, w, baseX: x, moving, phase: rand(0, 6), prevX: x });
}
// Swap primitive platforms for the Blender-built deck once it loads.
loadModel('platform')
  .then((template) => {
    for (const p of platforms) {
      for (const child of [...p.group.children]) p.group.remove(child);
      const deck = template.clone(true);
      deck.scale.x = p.w / 7;
      if (p.moving) recolor(deck, 'Glow', 0xffb84d, 0xffb84d);
      p.group.add(deck);
    }
  })
  .catch(() => undefined);
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) {
  const r = i % 2 === 0 ? 0.62 : 0.28, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
}
starShape.closePath();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
starGeo.center();
const starMat = glow(0xffd54a, 1.6, { metalness: 0.6, roughness: 0.3 });
interface Star { mesh: THREE.Object3D; platform: Platform; phase: number }
const stars: Star[] = [];
for (let i = 1; i < 22; i++) {
  if (stars.length >= TOTAL + 3) break;
  const p = platforms[i];
  const group = new THREE.Group();
  group.position.set(p.x, 1.7, p.z);
  const placeholder = mesh(starGeo, starMat, group, 0, 0, 0, false);
  scene.add(group);
  stars.push({ mesh: group, platform: p, phase: rand(0, 6) });
  swapModel(group, placeholder, 'star');
}

// ---------- Player astronaut ----------
const player = new THREE.Group();
player.position.set(0, 1, 0);
scene.add(player);
// Primitive placeholder, replaced by the Blender-built GLB once it loads.
const astroBody = new THREE.Group();
player.add(astroBody);
const suitMat = std(0xf2f4f8, { roughness: 0.55, metalness: 0.1 });
const visorMat = std(0x1b2a4a, { metalness: 0.95, roughness: 0.05, emissive: 0x204a8a, emissiveIntensity: 0.4 });
const packMat = std(0x9aa3b5, { metalness: 0.6, roughness: 0.4 });
let torso: THREE.Object3D = mesh(new THREE.CapsuleGeometry(0.4, 0.55, 4, 12), suitMat, astroBody, 0, 0.1, 0);
mesh(new THREE.SphereGeometry(0.42, 18, 14), suitMat, astroBody, 0, 0.95, 0);
mesh(new THREE.SphereGeometry(0.3, 16, 12), visorMat, astroBody, 0, 0.98, -0.2);
box(0.55, 0.65, 0.3, packMat, astroBody, 0, 0.3, 0.42);
for (const x of [-0.55, 0.55]) mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), suitMat, astroBody, x, 0.15, 0);
let legs: THREE.Object3D[] = [-0.2, 0.2].map((x) => mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 8), suitMat, astroBody, x, -0.6, 0));
swapModel(player, astroBody, 'astronaut', (model) => {
  torso = model;
  legs = ['Leg_L', 'Leg_R'].map((n) => model.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
});
const jetMat = glow(0x66b3ff, 4, { transparent: true, opacity: 0.9 });
const jets = [-0.18, 0.18].map((x) => {
  const jet = mesh(new THREE.ConeGeometry(0.12, 0.6, 8), jetMat, player, x, -0.1, 0.5, false);
  jet.rotation.x = Math.PI;
  jet.visible = false;
  return jet;
});
const playerLight = new THREE.PointLight(0x66b3ff, 0, 6, 2);
playerLight.position.set(0, 0, 0.6);
player.add(playerLight);

const dust = new Particles(scene, 500, 0.35, 6);
const jetTrail = new Particles(scene, 600, 0.3, -1);
const sparkle = new Particles(scene, 500, 0.4, 1.5);
const shake = new Shake();

// ---------- State ----------
const held = createInput(['up', 'down', 'left', 'right', 'action'] as const, { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'action', Enter: 'action' });
bindMute();
let started = false, ended = false, startedAt = 0, elapsed = 0, last = performance.now();
let score = 0, vy = 0, grounded = true, jumpWasHeld = false, jumpsLeft = 2, sinceGround = 0, squash = 1, facing = Math.PI, maxAlt = 0;
let groundedOn: Platform | null = platforms[0];
const hud = {
  stars: document.getElementById('stars')!,
  jumps: document.getElementById('jumps')!,
  height: document.getElementById('height')!,
  timer: document.getElementById('timer')!,
  message: document.getElementById('message')!,
};

function finish(won: boolean): void {
  ended = true;
  jets.forEach((j) => (j.visible = false));
  if (won) sfx.win(); else sfx.lose();
  showResults(hud.message, { won, score: Math.min(score, TOTAL), goal: TOTAL, scoreLabel: 'Stars', durationMs: Math.round(performance.now() - startedAt), winTitle: '🏆 CONSTELLATION COMPLETE', loseTitle: '🌌 LOST IN SPACE' });
}

function platformUnder(x: number, z: number): Platform | null {
  for (const p of platforms) if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= 2.5) return p;
  return null;
}

function updateJumpsHud(): void {
  hud.jumps.textContent = `JETS ${'●'.repeat(Math.max(0, jumpsLeft - 1))}${'○'.repeat(Math.max(0, 1 - (jumpsLeft - 1)))}`;
}

const camTarget = new THREE.Vector3();
const jetDir = new THREE.Vector3();
const jetPos = new THREE.Vector3();

function update(dt: number): void {
  // Moving platforms
  for (const p of platforms) {
    p.prevX = p.x;
    if (p.moving) {
      p.x = p.baseX + Math.sin(elapsed * 0.9 + p.phase) * 3.2;
      p.group.position.x = p.x;
    }
  }
  if (grounded && groundedOn?.moving) player.position.x += groundedOn.x - groundedOn.prevX;

  const dx = Number(held.right) - Number(held.left);
  const dz = held.up ? -1 : held.down ? 1 : -0.75;
  player.position.x = clamp(player.position.x + dx * 8 * dt, -14, 14);
  player.position.z += dz * 8 * dt;
  const moving = dx !== 0 || held.up || held.down;
  if (moving || !grounded) {
    const desired = Math.atan2(dx, dz) + Math.PI;
    let delta = desired - facing;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    facing += delta * Math.min(1, dt * 8);
  }
  player.rotation.y = facing;

  const under = platformUnder(player.position.x, player.position.z);
  if (grounded && !under) {
    grounded = false;
    groundedOn = null;
  }
  sinceGround = grounded ? 0 : sinceGround + dt;

  // Jump / jet boost
  const wantJump = held.action && !jumpWasHeld;
  if (wantJump) {
    if (grounded || sinceGround < 0.12) {
      vy = 10.5;
      grounded = false;
      groundedOn = null;
      jumpsLeft = 1;
      sinceGround = 1;
      squash = 1.25;
      sfx.jump();
      dust.burst(player.position.clone().setY(player.position.y - 0.9), 20, 0xcfd8ff, 3, 0.5, 0.4);
    } else if (jumpsLeft > 0) {
      vy = 9.8;
      jumpsLeft -= 1;
      squash = 1.2;
      sfx.doubleJump();
      flash('#66b3ff', 0.15);
      jetTrail.burst(player.position, 50, 0x66b3ff, 6, 0.6, 0.3);
      playerLight.intensity = 10;
    }
    updateJumpsHud();
  }
  jumpWasHeld = held.action;

  if (!grounded) {
    vy -= 24 * dt;
    player.position.y += vy * dt;
    const landing = platformUnder(player.position.x, player.position.z);
    if (vy <= 0 && player.position.y <= 1 && player.position.y > 0.2 && landing) {
      player.position.y = 1;
      vy = 0;
      grounded = true;
      groundedOn = landing;
      jumpsLeft = 2;
      squash = 0.65;
      sfx.land();
      shake.add(0.12);
      dust.burst(player.position.clone().setY(0.1), 30, 0xcfd8ff, 4, 0.5, 0.6);
      updateJumpsHud();
    }
    const thrusting = vy > 0;
    for (const jet of jets) {
      jet.visible = true;
      jet.scale.set(rand(0.7, 1.2), thrusting ? rand(0.9, 1.5) : rand(0.3, 0.6), 1);
    }
    jetDir.set(0, -5, 2);
    for (const jet of jets) {
      jet.getWorldPosition(jetPos);
      jetTrail.stream(jetPos, thrusting ? 2 : 1, 0x66b3ff, jetDir, 1.2, 0.35, 0.08);
    }
  } else {
    for (const jet of jets) jet.visible = false;
  }
  playerLight.intensity = THREE.MathUtils.lerp(playerLight.intensity, grounded ? 0 : 3, 0.1);
  squash = THREE.MathUtils.lerp(squash, 1, 0.15);
  player.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  const stride = grounded && moving ? Math.sin(elapsed * 12) * 0.5 : grounded ? 0 : 0.4;
  if (legs.length === 2) {
    legs[0].rotation.x = stride;
    legs[1].rotation.x = -stride;
  }
  torso.rotation.x = grounded ? 0 : -0.25;

  // Stars
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    s.mesh.position.x = s.platform.x;
    s.mesh.position.y = 1.7 + Math.sin(elapsed * 2.5 + s.phase) * 0.2;
    s.mesh.rotation.y += dt * 2;
    if (Math.random() < 0.08) sparkle.emit(s.mesh.position.x + rand(-0.5, 0.5), s.mesh.position.y + rand(-0.5, 0.5), s.mesh.position.z + rand(-0.3, 0.3), 0, 0.8, 0, new THREE.Color(0xffd54a), 0.8);
    if (near2d(s.mesh.position.x, s.mesh.position.z, player.position.x, player.position.z, 1.5) && Math.abs(s.mesh.position.y - player.position.y) < 1.6) {
      scene.remove(s.mesh);
      stars.splice(i, 1);
      score += 1;
      sfx.pickup();
      sparkle.burst(s.mesh.position, 80, 0xffd54a, 6, 0.9, 0.3);
      sparkle.burst(s.mesh.position, 25, 0xffffff, 3, 0.5, 0.2);
      hud.stars.textContent = `⭐ ${score} / ${TOTAL}`;
      pulse(hud.stars);
      setBar('progress', score / TOTAL);
      if (score >= TOTAL) finish(true);
    }
  }

  maxAlt = Math.max(maxAlt, player.position.y);
  hud.height.textContent = `ALT ${Math.max(0, Math.round((player.position.y - 1) * 3))} m`;
  hud.timer.textContent = formatTime(performance.now() - startedAt);
  if (player.position.y < -14) finish(false);
}

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;
  if (started && !ended) update(dt);
  else {
    for (const p of platforms) if (p.moving) { p.x = p.baseX + Math.sin(elapsed * 0.9 + p.phase) * 3.2; p.group.position.x = p.x; }
    for (const s of stars) { s.mesh.position.x = s.platform.x; s.mesh.rotation.y += dt * 2; s.mesh.position.y = 1.7 + Math.sin(elapsed * 2.5 + s.phase) * 0.2; }
  }
  bigPlanet.rotation.y += dt * 0.02;
  moonlet.rotation.y += dt * 0.08;
  for (const p of platforms) p.group.position.y = Math.sin(elapsed * 0.7 + p.phase) * 0.08;
  dust.update(dt);
  jetTrail.update(dt);
  sparkle.update(dt);
  sun.position.set(player.position.x + 20, player.position.y + 40, player.position.z + 30);
  sun.target.position.set(player.position.x, 0, player.position.z);
  camTarget.set(player.position.x * 0.6, Math.max(player.position.y, -2) + 9, player.position.z + 15);
  camera.position.lerp(camTarget, 0.1);
  camera.lookAt(player.position.x * 0.5, Math.max(player.position.y, -2) + 0.5, player.position.z - 7);
  shake.apply(camera, dt);
  pipeline.render();
}

requestAnimationFrame(animate);
updateJumpsHud();
waitForStart(() => {
  started = true;
  startedAt = performance.now();
});
