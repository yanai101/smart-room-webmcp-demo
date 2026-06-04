// All Three.js setup, geometry, lighting, animations, and the render loop.
// The scene knows nothing about stages, WebMCP, or testing.
// It reacts to room state changes via updateSceneFromRoomState().
import * as THREE from 'three';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { RoomState } from './room/roomTypes';

// ── Tween system ──────────────────────────────────────────────────────────

type TweenFn = { elapsed: number; duration: number; easing:(t:number)=>number; update:(p:number)=>void; onComplete?:()=>void };
const tweens: TweenFn[] = [];

const ease = {
  inOut: (t: number) => t < .5 ? 2*t*t : 1-(-2*t+2)**2/2,
  out:   (t: number) => 1-(1-t)**3,
};

function tween(duration: number, update: (p:number)=>void, easing = ease.inOut, onComplete?: ()=>void) {
  tweens.push({ elapsed:0, duration, easing, update, onComplete });
}

function updateTweens(dt: number) {
  for (let i = tweens.length-1; i >= 0; i--) {
    const t = tweens[i];
    t.elapsed = Math.min(t.elapsed + dt, t.duration);
    t.update(t.easing(t.elapsed / t.duration));
    if (t.elapsed >= t.duration) { t.onComplete?.(); tweens.splice(i, 1); }
  }
}

function cancelAllTweens() { tweens.length = 0; }

// ── Module-level Three.js objects (populated by initScene) ────────────────

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
let bloomPass: UnrealBloomPass;
let canvas: HTMLCanvasElement;

// Animated materials
let screenMat: THREE.MeshStandardMaterial;
let ceilingMat: THREE.MeshStandardMaterial;
let lampMat: THREE.MeshStandardMaterial;

// Animated lights
let ambient: THREE.AmbientLight;
let roomDirLight: THREE.DirectionalLight;
let roomFillLight: THREE.DirectionalLight;
let roomLight: THREE.PointLight;
let lampSpot: THREE.SpotLight;
let screenGlow: THREE.PointLight;

// Animated meshes
let leftCurtain: THREE.Mesh;
let rightCurtain: THREE.Mesh;
let windowGlowMat: THREE.MeshBasicMaterial;  // warm overlay on the window pane
let windowLight: THREE.SpotLight;

const CURTAIN_OPEN          = { left: 2.35,  right: 5.65 };
const CURTAIN_CLOSED        = { left: 3.25,  right: 4.75 };
const WINDOW_LIGHT_MAX   = 18;   // subtle — ceiling light stays dominant
const WINDOW_GLOW_OPACITY = 0.55; // daylight overlay on the window pane

// State diff tracking for subscriber
let prevState: RoomState | null = null;

// ── Material factory ──────────────────────────────────────────────────────

function std(color: number, emissive=0, emissiveIntensity=0, roughness=0.85, metalness=0.1) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness });
}

// ── Geometry helpers ──────────────────────────────────────────────────────

function box(w:number,h:number,d:number,px:number,py:number,pz:number,m:THREE.MeshStandardMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  mesh.position.set(px,py,pz); scene.add(mesh); return mesh;
}
function cyl(rt:number,rb:number,h:number,px:number,py:number,pz:number,m:THREE.MeshStandardMaterial,segs=10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segs), m);
  mesh.position.set(px,py,pz); scene.add(mesh); return mesh;
}

// ── Private scene animations ──────────────────────────────────────────────

function animateTurnOnComputer() {
  const c0 = screenMat.emissive.clone(), i0 = screenMat.emissiveIntensity, g0 = screenGlow.intensity;
  tween(0.7, p => {
    screenMat.emissive.lerpColors(c0, new THREE.Color(0x44ff99), p);
    screenMat.emissiveIntensity = i0 + (1.4-i0)*p;
    screenGlow.intensity = g0 + (2.5-g0)*p;
  });
}

function animateTurnOffComputer() {
  const c0 = screenMat.emissive.clone(), i0 = screenMat.emissiveIntensity;
  tween(0.4, p => {
    screenMat.emissive.lerpColors(c0, new THREE.Color(0x000000), p);
    screenMat.emissiveIntensity = i0*(1-p);
    screenGlow.intensity *= (1-p*0.08);
  }, ease.out, () => { screenGlow.intensity = 0; });
}

function animateTurnOffRoomLight() {
  const d0 = roomDirLight.intensity, f0 = roomFillLight.intensity;
  const i0 = roomLight.intensity, e0 = ceilingMat.emissiveIntensity, a0 = ambient.intensity;
  tween(0.9, p => {
    roomDirLight.intensity       = d0*(1-p);
    roomFillLight.intensity      = f0*(1-p);
    roomLight.intensity          = i0*(1-p);
    ceilingMat.emissiveIntensity = e0*(1-p);
    ambient.intensity            = a0 + (0.4-a0)*p;
  });
}

function animateTurnOnRoomLight() {
  const d0 = roomDirLight.intensity, f0 = roomFillLight.intensity;
  const i0 = roomLight.intensity, e0 = ceilingMat.emissiveIntensity, a0 = ambient.intensity;
  tween(0.9, p => {
    roomDirLight.intensity       = d0 + (4.0-d0)*p;
    roomFillLight.intensity      = f0 + (1.5-f0)*p;
    roomLight.intensity          = i0 + (500-i0)*p;
    ceilingMat.emissiveIntensity = e0 + (3.0-e0)*p;
    ambient.intensity            = a0 + (1.5-a0)*p;
  });
}

function animateTurnOnDeskLamp() {
  const i0 = lampSpot.intensity, e0 = lampMat.emissiveIntensity;
  tween(0.7, p => {
    lampSpot.intensity        = i0 + (120-i0)*p;
    lampMat.emissiveIntensity = e0 + (2.5-e0)*p;
  });
}

function animateTurnOffDeskLamp() {
  const i0 = lampSpot.intensity, e0 = lampMat.emissiveIntensity;
  tween(0.4, p => {
    lampSpot.intensity        = i0*(1-p);
    lampMat.emissiveIntensity = e0*(1-p);
  });
}

function animateCloseCurtains() {
  const lx = leftCurtain.position.x, rx = rightCurtain.position.x;
  const li = windowLight.intensity, lo = windowGlowMat.opacity;
  tween(1.2, p => {
    leftCurtain.position.x  = lx + (CURTAIN_CLOSED.left  - lx)*p;
    rightCurtain.position.x = rx + (CURTAIN_CLOSED.right - rx)*p;
    windowLight.intensity   = li * (1 - p);
    windowGlowMat.opacity   = lo * (1 - p);
  });
}

function animateOpenCurtains() {
  const lx = leftCurtain.position.x, rx = rightCurtain.position.x;
  const li = windowLight.intensity, lo = windowGlowMat.opacity;
  tween(1.2, p => {
    leftCurtain.position.x  = lx + (CURTAIN_OPEN.left  - lx)*p;
    rightCurtain.position.x = rx + (CURTAIN_OPEN.right - rx)*p;
    windowLight.intensity   = li + (WINDOW_LIGHT_MAX   - li)*p;
    windowGlowMat.opacity   = lo + (WINDOW_GLOW_OPACITY - lo)*p;
  });
}

function applyStateInstantly(s: RoomState) {
  if (s.computer) {
    screenMat.emissive.set(0x44ff99); screenMat.emissiveIntensity = 1.4; screenGlow.intensity = 2.5;
  } else {
    screenMat.emissive.set(0x000000); screenMat.emissiveIntensity = 0; screenGlow.intensity = 0;
  }
  if (s.roomLight) {
    roomDirLight.intensity = 4.0; roomFillLight.intensity = 1.5; roomLight.intensity = 500;
    ceilingMat.emissiveIntensity = 3.0; ambient.intensity = 1.5;
  } else {
    roomDirLight.intensity = 0; roomFillLight.intensity = 0; roomLight.intensity = 0;
    ceilingMat.emissiveIntensity = 0; ambient.intensity = 0.4;
  }
  if (s.deskLamp) {
    lampSpot.intensity = 120; lampMat.emissiveIntensity = 2.5;
  } else {
    lampSpot.intensity = 0; lampMat.emissiveIntensity = 0;
  }
  leftCurtain.position.x  = s.curtains === 'closed' ? CURTAIN_CLOSED.left  : CURTAIN_OPEN.left;
  rightCurtain.position.x = s.curtains === 'closed' ? CURTAIN_CLOSED.right : CURTAIN_OPEN.right;
  windowLight.intensity = s.curtains === 'closed' ? 0 : WINDOW_LIGHT_MAX;
  windowGlowMat.opacity = s.curtains === 'closed' ? 0 : WINDOW_GLOW_OPACITY;
}

// ── Public API ────────────────────────────────────────────────────────────

export function updateSceneFromRoomState(state: RoomState, instant = false): void {
  if (instant || prevState === null) {
    cancelAllTweens();
    applyStateInstantly(state);
    prevState = { ...state };
    return;
  }
  if (state.computer  !== prevState.computer)  state.computer  ? animateTurnOnComputer()   : animateTurnOffComputer();
  if (state.roomLight !== prevState.roomLight) state.roomLight ? animateTurnOnRoomLight()  : animateTurnOffRoomLight();
  if (state.deskLamp  !== prevState.deskLamp)  state.deskLamp  ? animateTurnOnDeskLamp()   : animateTurnOffDeskLamp();
  if (state.curtains  !== prevState.curtains)  state.curtains === 'closed' ? animateCloseCurtains() : animateOpenCurtains();
  prevState = { ...state };
}

export function initScene(canvasEl: HTMLCanvasElement): void {
  canvas = canvasEl;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08081a);

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(8, 10, 15);
  camera.lookAt(0, 3, -1);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.5;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.7, 0.4, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // ── Materials ───────────────────────────────────────────────────────────
  const mFloor   = std(0x2e2e50, 0x050518, 0.03, 0.85, 0.1);
  const mWall    = std(0x242440, 0, 0, 0.9, 0.05);
  const mDesk    = std(0x303058, 0, 0, 0.75, 0.25);
  const mChrome  = std(0x484870, 0, 0, 0.4, 0.75);
  const mCurtain = std(0x30184a, 0x4400cc, 0.08, 0.9, 0.05);
  const mChair   = std(0x1e2840, 0, 0, 0.82, 0.18);
  const mNeon    = std(0x003040, 0x00e5ff, 4.0, 0.9, 0.1);
  const mNight   = std(0x060612, 0x2a0077, 1.2, 0.95, 0);
  const mMonitor = std(0x28283c, 0, 0, 0.65, 0.45);
  const mStars   = std(0xffffff, 0xffffff, 4.0);

  screenMat  = std(0x22223a, 0x000000, 0, 0.9, 0.1);
  ceilingMat = std(0xffffff, 0xffffff, 3.0, 0.85, 0.1);
  lampMat    = std(0x362030, 0xffcc66, 0.0, 0.7, 0.3);

  // ── Lights ──────────────────────────────────────────────────────────────
  ambient       = new THREE.AmbientLight(0x2030a0, 1.5);
  roomDirLight  = new THREE.DirectionalLight(0xd8e8ff, 4.0);
  roomDirLight.position.set(0, 1, 0.3);
  roomFillLight = new THREE.DirectionalLight(0x8090c8, 1.5);
  roomFillLight.position.set(1, 0.5, 1);
  roomLight     = new THREE.PointLight(0xd0dcff, 500, 0, 2);
  roomLight.position.set(0, 9.2, 0);
  lampSpot      = new THREE.SpotLight(0xffcc66, 0, 0, Math.PI/5, 0.45, 2);
  lampSpot.position.set(-0.95, 4.5, -3.3);
  lampSpot.target.position.set(-0.3, 2.9, -3.8);
  screenGlow    = new THREE.PointLight(0x44ff99, 0, 0, 2);
  screenGlow.position.set(0, 4.3, -3.5);
  scene.add(ambient, roomDirLight, roomFillLight, roomLight, lampSpot, lampSpot.target, screenGlow);

  // ── Room shell ──────────────────────────────────────────────────────────
  box(16,0.2,14,  0,-0.1,  0, mFloor);
  box(16,10,0.2,  0, 5,  -7, mWall);
  box(0.2,10,14, -8, 5,   0, mWall);
  box(0.2,10,14,  8, 5,   0, mWall);
  box(16,0.2,14,  0,10.1, 0, mWall);

  box(16,0.04,0.04,  0,0.03,-6.9, mNeon);
  box(0.04,0.04,14, -7.9,0.03,0,  mNeon);
  box(16,0.04,0.04,  0,9.97,-6.9, mNeon);

  // ── Desk ────────────────────────────────────────────────────────────────
  box(5.2,0.15,2.2,   0,2.85,-3.8, mDesk);
  box(0.12,2.85,2.2,-2.5,1.425,-3.8, mDesk);
  box(0.12,2.85,2.2, 2.5,1.425,-3.8, mDesk);

  // ── Computer ────────────────────────────────────────────────────────────
  box(0.9,0.07,0.5,  0,2.93,-4.2,  mChrome);
  box(0.1,0.82,0.1,  0,3.37,-4.3,  mChrome);
  box(3,1.9,0.14,    0,4.25,-4.35, mMonitor);
  box(3.04,0.07,0.14,0,5.22,-4.35, mChrome);
  box(3.04,0.07,0.14,0,3.28,-4.35, mChrome);

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.65), screenMat);
  screenMesh.position.set(0,4.25,-4.27);
  scene.add(screenMesh);

  // ── Desk lamp ────────────────────────────────────────────────────────────
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-1.8,2.85,-3.6);
  scene.add(lampGroup);
  const addLamp = (geo:THREE.BufferGeometry,px:number,py:number,pz:number,mat:THREE.MeshStandardMaterial,rx=0,ry=0,rz=0)=>{
    const m=new THREE.Mesh(geo,mat); m.position.set(px,py,pz); m.rotation.set(rx,ry,rz); lampGroup.add(m); return m;
  };
  addLamp(new THREE.CylinderGeometry(0.18,0.18,0.05,12), 0,0.025,0,  mChrome);
  addLamp(new THREE.CylinderGeometry(0.035,0.035,1.5,8), 0,0.775,0,  mChrome);
  addLamp(new THREE.CylinderGeometry(0.025,0.025,1.1,8), 0.42,1.52,0.15, mChrome, 0,0,Math.PI/4);
  addLamp(new THREE.CylinderGeometry(0.12,0.26,0.27,12), 0.9,1.6,0.2,  lampMat, 0,0,-Math.PI/2.5);

  // ── Ceiling light panel ──────────────────────────────────────────────────
  box(3.5,0.1,1.8, 0,9.97,0, ceilingMat);

  // ── Window ──────────────────────────────────────────────────────────────
  box(3.2,4.2,0.3, 4,5.5,-6.88, mWall);
  const nightSky = new THREE.Mesh(new THREE.PlaneGeometry(2.7,3.7), mNight);
  nightSky.position.set(4,5.5,-6.73);
  scene.add(nightSky);

  const starPositions: [number,number,number][] = [
    [2.6,6.9,-6.7],[3.3,7.1,-6.7],[4.6,7.3,-6.7],[5.1,6.7,-6.7],[2.9,6.3,-6.7],
    [4.2,7.0,-6.7],[3.8,7.5,-6.7],[4.9,7.2,-6.7],[4.7,6.0,-6.7],[2.4,7.4,-6.7],
  ];
  for (const [px,py,pz] of starPositions) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.01), mStars);
    s.position.set(px,py,pz); scene.add(s);
  }

  // ── Curtains ────────────────────────────────────────────────────────────
  leftCurtain  = box(1.25,4.2,0.12, CURTAIN_OPEN.left,  5.5,-6.77, mCurtain);
  rightCurtain = box(1.25,4.2,0.12, CURTAIN_OPEN.right, 5.5,-6.77, mCurtain);

  // ── Daylight from window ─────────────────────────────────────────────────
  // SpotLight outside the window — warm daylight, fades when curtains close.
  windowLight = new THREE.SpotLight(0xfff5d0, WINDOW_LIGHT_MAX, 0, Math.PI / 3.5, 0.7, 2);
  windowLight.position.set(5, 10, -11);
  windowLight.target.position.set(1.5, 0, -3);
  scene.add(windowLight, windowLight.target);

  // White daylight overlay on the window pane — makes the window look bright.
  // Fades out when the curtains close so the room returns to ceiling-light-only state.
  windowGlowMat = new THREE.MeshBasicMaterial({
    color: 0xc8deff,          // cool white-blue daylight haze
    transparent: true,
    opacity: WINDOW_GLOW_OPACITY,
    depthWrite: false,
    // Normal blending — transparent overlay, keeps night sky partially visible
  });
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.5), windowGlowMat);
  windowGlow.position.set(4.0, 5.5, -6.65);  // in front of the night-sky plane
  scene.add(windowGlow);

  // ── Chair ───────────────────────────────────────────────────────────────
  box(2,0.18,1.9,     0,1.2, -0.9, mChair);
  box(1.9,1.6,0.15,   0,2.15,-1.82,mChair);
  box(0.12,0.3,1.9,-0.94,1.62,-0.9,mChair);
  box(0.12,0.3,1.9, 0.94,1.62,-0.9,mChair);
  box(1.4,0.06,0.1,   0,0.29,-0.9, mChrome);
  box(0.1,0.06,1.4,   0,0.29,-0.9, mChrome);
  cyl(0.08,0.08,0.7,  0,0.66,-0.9, mChrome,8);
  cyl(0.07,0.07,0.12,-0.65,0.15,-0.4,mChrome,8);
  cyl(0.07,0.07,0.12, 0.65,0.15,-0.4,mChrome,8);
  cyl(0.07,0.07,0.12, 0,0.15,-1.5, mChrome,8);

  // ── Resize handler + render loop ─────────────────────────────────────────
  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  let lastTime = 0;
  function renderLoop(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    updateTweens(dt);
    composer.render();
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
}
