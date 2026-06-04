// ─────────────────────────────────────────────────────────────────────────────
// Smart Room — Playwright MCP vs WebMCP  |  Conference Demo
// "Playwright MCP understands the interface. WebMCP understands the capabilities."
//
// Files: index.html  style.css  main.ts
// Stack: Vite + TypeScript + Three.js   (no React, no R3F, no state libs)
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DECLARATIONS
// ═══════════════════════════════════════════════════════════════════════════

type RoomMode  = 'night-coding' | 'presentation' | 'sleep' | 'reset';
type RoomState = { computer: boolean; roomLight: boolean; deskLamp: boolean; curtains: 'open' | 'closed' };

declare global {
  interface Navigator {
    modelContext?: {
      registerTool(tool: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute(args: Record<string, unknown>): Promise<unknown> | unknown;
      }): void;
    };
  }
  interface Window {
    smartRoom: {
      getState(): RoomState;
      resetRoom(): void;
      turnOnComputer(): void;
      turnOffRoomLight(): void;
      turnOnDeskLamp(): void;
      closeCurtains(): void;
      setRoomMode(mode: string): void;
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Three.js Setup
// ═══════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('room') as HTMLCanvasElement;
const panel  = document.getElementById('panel') as HTMLElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08081a);

// Fixed camera — 3/4 view of the room, never moves
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(8, 10, 15);
camera.lookAt(0, 3, -1);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// ACESFilmic tone mapping lifts dark values and compresses bright ones — essential for PBR rooms
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.5;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(800, 600), 0.7, 0.4, 0.85);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Tween System  (zero dependencies)
// ═══════════════════════════════════════════════════════════════════════════

type TweenFn = { elapsed: number; duration: number; easing:(t:number)=>number; update:(p:number)=>void; onComplete?:()=>void; };
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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Room Geometry
// Only BoxGeometry, PlaneGeometry, CylinderGeometry — no GLTF, no textures.
// Beauty from: lighting, emissive materials, UnrealBloom, animation.
// ═══════════════════════════════════════════════════════════════════════════

// ── Material factory ───────────────────────────────────────────────────────
function std(color: number, emissive=0, emissiveIntensity=0, roughness=0.85, metalness=0.1) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness });
}

// Static room materials — visible base colors for PBR + ACES tone mapping
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

// Animated materials — modified by room actions
const screenMat  = std(0x22223a, 0x000000, 0,   0.9, 0.1);
const ceilingMat = std(0xffffff, 0xffffff, 3.0, 0.85, 0.1);
const lampMat    = std(0x362030, 0xffcc66, 0.0, 0.7, 0.3);

// ── Lights ────────────────────────────────────────────────────────────────
// Lighting: DirectionalLight for even room fill (no falloff), SpotLight for desk lamp.
// DirectionalLight intensity is in lux — much more predictable than point lights for room demos.
const ambient    = new THREE.AmbientLight(0x2030a0, 1.5);          // dim blue-purple base
const roomDirLight = new THREE.DirectionalLight(0xd8e8ff, 4.0);    // main ceiling fill, 4 lux
roomDirLight.position.set(0, 1, 0.3);                              // from directly above
const roomFillLight = new THREE.DirectionalLight(0x8090c8, 1.5);   // soft front fill
roomFillLight.position.set(1, 0.5, 1);

// Keep a soft point light at ceiling for localised glow around the ceiling panel
const roomLight  = new THREE.PointLight(0xd0dcff, 500, 0, 2);
roomLight.position.set(0, 9.2, 0);

const lampSpot   = new THREE.SpotLight(0xffcc66, 0, 0, Math.PI/5, 0.45, 2);
lampSpot.position.set(-0.95, 4.5, -3.3);
lampSpot.target.position.set(-0.3, 2.9, -3.8);

const screenGlow = new THREE.PointLight(0x44ff99, 0, 0, 2);
screenGlow.position.set(0, 4.3, -3.5);

scene.add(ambient, roomDirLight, roomFillLight, roomLight, lampSpot, lampSpot.target, screenGlow);

// ── Geometry helpers ───────────────────────────────────────────────────────
function box(w:number, h:number, d:number, px:number, py:number, pz:number, m:THREE.MeshStandardMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  mesh.position.set(px,py,pz);
  scene.add(mesh);
  return mesh;
}
function cyl(rt:number, rb:number, h:number, px:number, py:number, pz:number, m:THREE.MeshStandardMaterial, segs=10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segs), m);
  mesh.position.set(px,py,pz);
  scene.add(mesh);
  return mesh;
}

// ── Room shell ────────────────────────────────────────────────────────────
box(16,0.2,14,  0,-0.1,  0, mFloor);
box(16,10,0.2,  0, 5,  -7, mWall);      // back wall
box(0.2,10,14, -8, 5,   0, mWall);      // left wall
box(0.2,10,14,  8, 5,   0, mWall);      // right wall
box(16,0.2,14,  0,10.1, 0, mWall);      // ceiling

// Neon accent strips (cyberpunk atmosphere)
box(16,0.04,0.04,  0,0.03,-6.9, mNeon);   // floor × back wall
box(0.04,0.04,14, -7.9,0.03,0,  mNeon);   // floor × left wall
box(16,0.04,0.04,  0,9.97,-6.9, mNeon);   // ceiling × back wall

// ── Desk ──────────────────────────────────────────────────────────────────
box(5.2,0.15,2.2,  0,2.85,-3.8, mDesk);   // surface
box(0.12,2.85,2.2,-2.5,1.425,-3.8, mDesk); // left support
box(0.12,2.85,2.2, 2.5,1.425,-3.8, mDesk); // right support

// ── Computer ──────────────────────────────────────────────────────────────
box(0.9,0.07,0.5,  0,2.93,-4.2,  mChrome);  // stand base
box(0.1,0.82,0.1,  0,3.37,-4.3,  mChrome);  // stand pole
box(3,1.9,0.14,    0,4.25,-4.35, mMonitor); // monitor body
box(3.04,0.07,0.14,0,5.22,-4.35, mChrome);  // top bezel
box(3.04,0.07,0.14,0,3.28,-4.35, mChrome);  // bottom bezel

const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.65), screenMat);
screenMesh.position.set(0,4.25,-4.27);
scene.add(screenMesh);

// ── Desk lamp ─────────────────────────────────────────────────────────────
const lampGroup = new THREE.Group();
lampGroup.position.set(-1.8,2.85,-3.6);
scene.add(lampGroup);

const _addLamp = (geo:THREE.BufferGeometry, px:number,py:number,pz:number, mat:THREE.MeshStandardMaterial, rx=0,ry=0,rz=0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px,py,pz); m.rotation.set(rx,ry,rz);
  lampGroup.add(m); return m;
};
_addLamp(new THREE.CylinderGeometry(0.18,0.18,0.05,12),  0,0.025,0,  mChrome);
_addLamp(new THREE.CylinderGeometry(0.035,0.035,1.5,8),  0,0.775,0,  mChrome);
_addLamp(new THREE.CylinderGeometry(0.025,0.025,1.1,8),  0.42,1.52,0.15, mChrome, 0,0,Math.PI/4);
_addLamp(new THREE.CylinderGeometry(0.12,0.26,0.27,12),  0.9,1.6,0.2,  lampMat, 0,0,-Math.PI/2.5);

// ── Ceiling light panel ───────────────────────────────────────────────────
box(3.5,0.1,1.8, 0,9.97,0, ceilingMat);

// ── Window ────────────────────────────────────────────────────────────────
box(3.2,4.2,0.3, 4,5.5,-6.88, mWall);   // frame
const nightSky = new THREE.Mesh(new THREE.PlaneGeometry(2.7,3.7), mNight);
nightSky.position.set(4,5.5,-6.73);
scene.add(nightSky);

// Stars (tiny emissive boxes inside the window)
const starPositions: [number,number,number][] = [
  [2.6,6.9,-6.7],[3.3,7.1,-6.7],[4.6,7.3,-6.7],[5.1,6.7,-6.7],[2.9,6.3,-6.7],
  [4.2,7.0,-6.7],[3.8,7.5,-6.7],[4.9,7.2,-6.7],[4.7,6.0,-6.7],[2.4,7.4,-6.7],
];
for (const [px,py,pz] of starPositions) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.01), mStars);
  s.position.set(px,py,pz);
  scene.add(s);
}

// ── Curtains ──────────────────────────────────────────────────────────────
const CURTAIN_OPEN   = { left: 2.35,  right: 5.65 };
const CURTAIN_CLOSED = { left: 3.25,  right: 4.75 };
const leftCurtain  = box(1.25,4.2,0.12, CURTAIN_OPEN.left,  5.5,-6.77, mCurtain);
const rightCurtain = box(1.25,4.2,0.12, CURTAIN_OPEN.right, 5.5,-6.77, mCurtain);

// ── Chair ─────────────────────────────────────────────────────────────────
box(2,0.18,1.9,      0,1.2, -0.9, mChair);   // seat
box(1.9,1.6,0.15,    0,2.15,-1.82,mChair);   // backrest
box(0.12,0.3,1.9, -0.94,1.62,-0.9,mChair);   // left armrest
box(0.12,0.3,1.9,  0.94,1.62,-0.9,mChair);   // right armrest
box(1.4,0.06,0.1,    0,0.29,-0.9, mChrome);  // cross base
box(0.1,0.06,1.4,    0,0.29,-0.9, mChrome);
cyl(0.08,0.08,0.7,   0,0.66,-0.9, mChrome,8);// column
cyl(0.07,0.07,0.12, -0.65,0.15,-0.4,mChrome,8);
cyl(0.07,0.07,0.12,  0.65,0.15,-0.4,mChrome,8);
cyl(0.07,0.07,0.12,  0,0.15,-1.5, mChrome,8);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Room State & Actions
// The functions below drive the Three.js scene.
// These same functions are called by WebMCP tools — the key demo point.
// ═══════════════════════════════════════════════════════════════════════════

const roomState = {
  computer: false,
  roomLight: true,
  deskLamp:  false,
  curtains:  'open' as 'open'|'closed',
};

function turnOnComputer() {
  roomState.computer = true;
  const c0 = screenMat.emissive.clone(), i0 = screenMat.emissiveIntensity, g0 = screenGlow.intensity;
  tween(0.7, p => {
    screenMat.emissive.lerpColors(c0, new THREE.Color(0x44ff99), p);
    screenMat.emissiveIntensity = i0 + (1.4-i0)*p;
    screenGlow.intensity = g0 + (2.5-g0)*p;
  });
}
function turnOffComputer() {
  roomState.computer = false;
  const c0 = screenMat.emissive.clone(), i0 = screenMat.emissiveIntensity;
  tween(0.4, p => {
    screenMat.emissive.lerpColors(c0, new THREE.Color(0x000000), p);
    screenMat.emissiveIntensity = i0*(1-p);
    screenGlow.intensity *= (1-p*0.08);
  }, ease.out, () => { screenGlow.intensity = 0; });
}

function turnOffRoomLight() {
  roomState.roomLight = false;
  const d0 = roomDirLight.intensity, f0 = roomFillLight.intensity;
  const i0 = roomLight.intensity, e0 = ceilingMat.emissiveIntensity, a0 = ambient.intensity;
  tween(0.9, p => {
    roomDirLight.intensity        = d0*(1-p);
    roomFillLight.intensity       = f0*(1-p);
    roomLight.intensity           = i0*(1-p);
    ceilingMat.emissiveIntensity  = e0*(1-p);
    ambient.intensity             = a0 + (0.4-a0)*p;  // slight base ambient remains in dark
  });
}
function turnOnRoomLight() {
  roomState.roomLight = true;
  const d0 = roomDirLight.intensity, f0 = roomFillLight.intensity;
  const i0 = roomLight.intensity, e0 = ceilingMat.emissiveIntensity, a0 = ambient.intensity;
  tween(0.9, p => {
    roomDirLight.intensity        = d0 + (4.0-d0)*p;
    roomFillLight.intensity       = f0 + (1.5-f0)*p;
    roomLight.intensity           = i0 + (500-i0)*p;
    ceilingMat.emissiveIntensity  = e0 + (3.0-e0)*p;
    ambient.intensity             = a0 + (1.5-a0)*p;
  });
}

function turnOnDeskLamp() {
  roomState.deskLamp = true;
  const i0 = lampSpot.intensity, e0 = lampMat.emissiveIntensity;
  tween(0.7, p => {
    lampSpot.intensity          = i0 + (120-i0)*p;
    lampMat.emissiveIntensity   = e0 + (2.5-e0)*p;
  });
}
function turnOffDeskLamp() {
  roomState.deskLamp = false;
  const i0 = lampSpot.intensity, e0 = lampMat.emissiveIntensity;
  tween(0.4, p => {
    lampSpot.intensity        = i0*(1-p);
    lampMat.emissiveIntensity = e0*(1-p);
  });
}

function closeCurtains() {
  roomState.curtains = 'closed';
  const lx = leftCurtain.position.x, rx = rightCurtain.position.x;
  tween(1.2, p => {
    leftCurtain.position.x  = lx + (CURTAIN_CLOSED.left  - lx)*p;
    rightCurtain.position.x = rx + (CURTAIN_CLOSED.right - rx)*p;
  });
}
function openCurtains() {
  roomState.curtains = 'open';
  const lx = leftCurtain.position.x, rx = rightCurtain.position.x;
  tween(1.2, p => {
    leftCurtain.position.x  = lx + (CURTAIN_OPEN.left  - lx)*p;
    rightCurtain.position.x = rx + (CURTAIN_OPEN.right - rx)*p;
  });
}

// setRoomMode — the key WebMCP tool call.
// One function, one call. The room immediately responds.
function setRoomMode(mode: RoomMode | string) {
  if (mode === 'night-coding') {
    turnOnComputer(); turnOffRoomLight(); turnOnDeskLamp(); closeCurtains();
  } else if (mode === 'presentation') {
    turnOffComputer(); turnOnRoomLight(); turnOffDeskLamp(); openCurtains();
  } else if (mode === 'sleep') {
    turnOffComputer(); turnOffRoomLight(); turnOffDeskLamp(); closeCurtains();
  } else if (mode === 'reset') {
    resetRoom();
  }
}

function resetRoom() {
  tweens.length = 0;   // cancel all active animations
  roomState.computer  = false;
  roomState.roomLight = true;
  roomState.deskLamp  = false;
  roomState.curtains  = 'open';

  screenMat.emissive.set(0x000000);
  screenMat.emissiveIntensity = 0;
  screenGlow.intensity        = 0;

  roomDirLight.intensity        = 4.0;
  roomFillLight.intensity       = 1.5;
  roomLight.intensity           = 500;
  ceilingMat.emissiveIntensity  = 3.0;
  ambient.intensity             = 1.5;

  lampSpot.intensity          = 0;
  lampMat.emissiveIntensity   = 0;

  leftCurtain.position.x  = CURTAIN_OPEN.left;
  rightCurtain.position.x = CURTAIN_OPEN.right;
}

function getRoomState(): RoomState {
  return { ...roomState };
}

// Expose on window for DevTools debugging and Playwright capability-api tests.
// Try: window.smartRoom.setRoomMode("night-coding") then window.smartRoom.getState()
window.smartRoom = { getState: getRoomState, resetRoom, turnOnComputer, turnOffRoomLight, turnOnDeskLamp, closeCurtains, setRoomMode };

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4.5 — Real WebMCP Tool Registration
// Registers the same room-action functions as navigator.modelContext tools.
// Falls back gracefully to window.smartRoom when the API is unavailable.
// ═══════════════════════════════════════════════════════════════════════════

type WebMcpTool = { name: string; description: string; inputSchema: Record<string, unknown>; fn(args: Record<string, unknown>): void };

const WEBMCP_TOOLS: WebMcpTool[] = [
  { name: 'turnOnComputer',   description: 'Turn on the computer in the Smart Room',            inputSchema: { type:'object', properties:{}, additionalProperties:false }, fn: () => turnOnComputer()   },
  { name: 'turnOffRoomLight', description: 'Turn off the main ceiling light in the Smart Room', inputSchema: { type:'object', properties:{}, additionalProperties:false }, fn: () => turnOffRoomLight() },
  { name: 'turnOnDeskLamp',   description: 'Turn on the warm desk lamp in the Smart Room',      inputSchema: { type:'object', properties:{}, additionalProperties:false }, fn: () => turnOnDeskLamp()   },
  { name: 'closeCurtains',    description: 'Close the curtains in the Smart Room',              inputSchema: { type:'object', properties:{}, additionalProperties:false }, fn: () => closeCurtains()    },
  {
    name: 'setRoomMode', description: 'Prepare the Smart Room for a named activity mode',
    inputSchema: { type:'object', properties:{ mode:{ type:'string', enum:['night-coding','presentation','sleep','reset'] } }, required:['mode'], additionalProperties:false },
    fn: (args) => setRoomMode(args['mode'] as string),
  },
];

let webMcpStatus: { status: 'registered'|'unavailable'|'failed'|'pending'; message: string } =
  { status: 'pending', message: 'Initialising…' };

function updateWebMcpStatus(status: typeof webMcpStatus['status'], message: string) {
  webMcpStatus = { status, message };
  // Update badge in DOM if stage 4 is currently visible
  const badge = document.getElementById('webmcp-status-badge');
  if (badge) { badge.className = `webmcp-status-badge ${status}`; badge.textContent = message; }
}

function registerWebMcpTools() {
  if (!('modelContext' in navigator) || !navigator.modelContext) {
    console.warn('[SmartRoom] navigator.modelContext unavailable — window.smartRoom is the fallback');
    updateWebMcpStatus('unavailable', 'WebMCP unavailable — using window.smartRoom');
    return;
  }
  try {
    for (const tool of WEBMCP_TOOLS) {
      navigator.modelContext.registerTool({
        name: tool.name, description: tool.description, inputSchema: tool.inputSchema,
        execute(args) { tool.fn(args); return { success: true, state: getRoomState() }; },
      });
    }
    console.info('[SmartRoom] WebMCP tools registered:', WEBMCP_TOOLS.map(t => t.name).join(', '));
    updateWebMcpStatus('registered', `${WEBMCP_TOOLS.length} tools registered`);
  } catch (err) {
    console.error('[SmartRoom] WebMCP registration failed:', err);
    updateWebMcpStatus('failed', 'Tool registration failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Stage Definitions
// Each stage: render() builds the panel HTML, run() plays the scripted demo.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared helpers ────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
type LogType = 'command'|'info'|'success'|'error'|'warning'|'reasoning'|'phase-head';

function appendLog(stream: HTMLElement, text: string, type: LogType = 'info') {
  const icons: Record<LogType,string> = {
    command:'▸', info:'·', success:'✓', error:'✗',
    warning:'⚠', reasoning:'◈', 'phase-head':'◆'
  };
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.innerHTML = `<span class="log-icon">${icons[type]}</span><span>${text}</span>`;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

function countUp(el: HTMLElement, target: number, duration: number, suffix='') {
  const start = performance.now();
  function step(now: number) {
    const p = Math.min((now-start)/duration, 1);
    el.textContent = Math.round(target * ease.out(p)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function promptBox() {
  return `<div class="prompt-box">
    <span class="prompt-label">Prompt</span>
    <span class="prompt-text">"Prepare the room for night coding"</span>
  </div>`;
}

function speakerNote(note: string) {
  return `<div class="speaker-notes-panel">
    <button class="speaker-notes-toggle">⦿ Speaker Notes ▾</button>
    <p class="speaker-note-text">${note}</p>
  </div>`;
}

function codeBlock(lang: string, html: string) {
  return `<div class="code-block">
    <div class="code-header">
      <span class="code-lang">${lang}</span>
      <div class="code-dots"><span></span><span></span><span></span></div>
    </div>
    <div class="code-body"><pre>${html}</pre></div>
  </div>`;
}

function archFlow(steps: string[], highlight?: number) {
  return `<div class="architecture">
    <div class="arch-label">Architecture</div>
    <div class="arch-flow">${steps.map((s,i) => `
      <div class="arch-step${i===highlight?' highlight':''}">${s}</div>
      ${i<steps.length-1?'<div class="arch-arrow-down">↓</div>':''}
    `).join('')}</div>
  </div>`;
}

function timelineHtml(steps: {label:string,type:'ok'|'fail'|'warn'|'neutral'}[]) {
  return `<div class="timeline">${steps.map((s,i) => `
    <span class="timeline-step ${s.type==='fail'?'fail-step':s.type==='ok'?'ok-step':''}">${s.label}</span>
    ${i<steps.length-1?'<span class="timeline-sep">→</span>':''}
  `).join('')}</div>`;
}

function metricsHtml(items: {label:string,value:string,cls?:string}[]) {
  return `<div class="metrics">${items.map(m=>`
    <div class="metric">
      <span class="metric-label">${m.label}</span>
      <span class="metric-value ${m.cls??''}">${m.value}</span>
    </div>
  `).join('')}</div>`;
}

// ── Stage 1: Manual Browser Automation ────────────────────────────────────

const stage1 = {
  id:'manual', number:1, label:'Manual', color:'var(--red)',
  speakerNote: 'The agent is clicking pixels and hoping.',

  render(container: HTMLElement) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--red)">
      <span class="stage-badge">Stage 1 of 5</span>
      <h2 class="stage-title">Manual Browser Automation</h2>
      ${promptBox()}
      ${codeBlock('playwright.ts', `<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">420</span>, y: <span class="c-num">230</span> }
});

<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">180</span>, y: <span class="c-num">120</span> }
});

<span class="c-kw">await</span> page.<span class="c-fn">locator</span>(<span class="c-str">"canvas"</span>).<span class="c-fn">click</span>({
  position: { x: <span class="c-num">300</span>, y: <span class="c-num">410</span> }
});`)}
      <button class="run-btn" id="run-btn">▶ Run Manual Automation</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent is clicking pixels and hoping.')}
    </div>`;

    container.querySelector('#run-btn')!.addEventListener('click', () => stage1.run(container));
    container.querySelector('.speaker-notes-toggle')!.addEventListener('click', function(this:HTMLElement) {
      const note = container.querySelector('.speaker-note-text') as HTMLElement;
      note.hidden = !note.hidden;
    });
  },

  async run(container: HTMLElement) {
    const runBtn = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl  = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true;
    logEl.innerHTML = '';
    results.hidden  = true;
    logEl.hidden    = false;
    resetRoom();

    await delay(400);  appendLog(logEl, 'Clicking canvas at 420,230', 'command');
    await delay(700);  appendLog(logEl, 'Trying to locate computer...', 'info');
    await delay(900);  appendLog(logEl, 'No element under cursor', 'warning');
    await delay(700);  appendLog(logEl, 'Clicking canvas at 180,120', 'command');
    await delay(700);  appendLog(logEl, 'Trying to locate room light...', 'info');
    await delay(900);  appendLog(logEl, 'Something changed — uncertain what', 'warning');
    // Wrong action: turns on desk lamp instead of the intended controls
    turnOnDeskLamp();
    await delay(700);  appendLog(logEl, 'Clicking canvas at 300,410', 'command');
    await delay(900);  appendLog(logEl, 'Unexpected result', 'warning');
    await delay(500);  appendLog(logEl, '✗ Automation Failed', 'error');

    await delay(600);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict fail">❌ Automation Failed</div>
      ${timelineHtml([{label:'click',type:'neutral'},{label:'click',type:'neutral'},{label:'click',type:'neutral'},{label:'fail',type:'fail'}])}
      ${metricsHtml([
        {label:'Clicks',value:'3'},
        {label:'Reasoning',value:'0'},
        {label:'Success',value:'Failed',cls:'fail'},
        {label:'Room State',value:'Wrong',cls:'fail'},
      ])}
      <div class="message">"The agent is clicking pixels and hoping."</div>`;

    runBtn.disabled = false;
  }
};

// ── Stage 2: Traditional Playwright ───────────────────────────────────────

const stage2 = {
  id:'playwright', number:2, label:'Playwright', color:'var(--red)',
  speakerNote: 'Real selectors — but a canvas exposes nothing to the DOM, so even proper Playwright can\'t find the controls.',

  render(container: HTMLElement) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--red)">
      <span class="stage-badge">Stage 2 of 5</span>
      <h2 class="stage-title">Traditional Playwright</h2>
      ${promptBox()}
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">
        Using proper semantic locators — the <em>right</em> way to automate the browser.
      </p>
      ${codeBlock('test.spec.ts', `<span class="c-kw">await</span> page.<span class="c-fn">getByRole</span>(<span class="c-str">'button'</span>, { name: <span class="c-str">'Power'</span> }).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByLabel</span>(<span class="c-str">'Room Light'</span>).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByTestId</span>(<span class="c-str">'desk-lamp'</span>).<span class="c-fn">click</span>();

<span class="c-kw">await</span> page.<span class="c-fn">getByRole</span>(<span class="c-str">'button'</span>, { name: <span class="c-str">'Curtains'</span> }).<span class="c-fn">click</span>();`)}
      <button class="run-btn" id="run-btn">▶ Run Playwright Test</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('Real selectors — but a canvas exposes nothing to the DOM, so even proper Playwright can\'t find the controls.')}
    </div>`;

    container.querySelector('#run-btn')!.addEventListener('click', () => stage2.run(container));
    container.querySelector('.speaker-notes-toggle')!.addEventListener('click', function() {
      const note = container.querySelector('.speaker-note-text') as HTMLElement;
      note.hidden = !note.hidden;
    });
  },

  async run(container: HTMLElement) {
    const runBtn = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl  = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true;
    logEl.innerHTML = '';
    results.hidden  = true;
    logEl.hidden    = false;
    resetRoom();  // room stays exactly like this — nothing will change

    await delay(500);  appendLog(logEl, 'playwright test --headed', 'command');
    await delay(700);  appendLog(logEl, 'Running 1 test in 1 file...', 'info');
    await delay(800);  appendLog(logEl, "Locating getByRole('button', { name: 'Power' })", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1200); appendLog(logEl, "Locating getByLabel('Room Light')", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1200); appendLog(logEl, "Locating getByTestId('desk-lamp')", 'command');
    await delay(1000); appendLog(logEl, 'Waiting for element...', 'info');
    await delay(1500); appendLog(logEl, '⏱ TimeoutError: locator.click: Timeout 30000ms exceeded', 'error');
    await delay(400);  appendLog(logEl, '  0 elements matched any selector', 'error');
    await delay(400);  appendLog(logEl, '  The room is a <canvas>. There is nothing in the DOM.', 'warning');

    await delay(700);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict fail">❌ TimeoutError — 0 Elements Found</div>
      ${timelineHtml([{label:'launch',type:'neutral'},{label:'locate',type:'neutral'},{label:'wait',type:'neutral'},{label:'timeout',type:'fail'}])}
      ${metricsHtml([
        {label:'Selectors Tried',value:'4'},
        {label:'Elements Found',value:'0',cls:'fail'},
        {label:'Success',value:'Failed',cls:'fail'},
        {label:'Room Changed',value:'No',cls:'fail'},
      ])}
      <div class="message">"Real selectors, but a canvas exposes nothing to the DOM to select."</div>`;

    runBtn.disabled = false;
  }
};

// ── Stage 3: Playwright MCP ────────────────────────────────────────────────

const stage3 = {
  id:'pwmcp', number:3, label:'Playwright MCP', color:'var(--amber)',
  speakerNote: 'The agent can use the browser, but it still needs to understand the UI.',

  render(container: HTMLElement) {
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--amber)">
      <span class="stage-badge">Stage 3 of 5</span>
      <h2 class="stage-title">Playwright MCP</h2>
      ${promptBox()}
      ${archFlow(['Prompt','LLM','Playwright MCP','Browser → UI'], 2)}
      <button class="run-btn" id="run-btn" style="--stage-color:var(--amber)">▶ Run Playwright MCP</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent can use the browser, but it still needs to understand the UI.')}
    </div>`;

    container.querySelector('#run-btn')!.addEventListener('click', () => stage3.run(container));
    container.querySelector('.speaker-notes-toggle')!.addEventListener('click', function() {
      const note = container.querySelector('.speaker-note-text') as HTMLElement;
      note.hidden = !note.hidden;
    });
  },

  async run(container: HTMLElement) {
    const runBtn = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl  = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true;
    logEl.innerHTML = '';
    results.hidden  = true;
    logEl.hidden    = false;
    resetRoom();

    await delay(400);  appendLog(logEl, 'browser_navigate("http://localhost:5173")', 'command');
    await delay(800);  appendLog(logEl, 'Opening smart room...', 'info');
    await delay(700);  appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(900);  appendLog(logEl, 'Found 37 interactive elements', 'success');
    await delay(1000); appendLog(logEl, '[reasoning] Searching for room controls...', 'reasoning');
    await delay(900);  appendLog(logEl, 'browser_snapshot({ region: "panel" })', 'command');
    await delay(800);  appendLog(logEl, 'Found settings panel with power controls', 'success');
    await delay(1000); appendLog(logEl, '[reasoning] Identifying power toggle for computer', 'reasoning');
    await delay(800);  appendLog(logEl, 'browser_click({ element: "Power toggle" })', 'command');
    turnOnComputer();
    await delay(800);  appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(600);  appendLog(logEl, 'Verified: computer = ON ✓', 'success');
    await delay(800);  appendLog(logEl, '[reasoning] Locate room light control', 'reasoning');
    await delay(700);  appendLog(logEl, 'browser_click({ element: "Room Light" })', 'command');
    turnOffRoomLight();
    await delay(800);  appendLog(logEl, '[reasoning] Locate desk lamp toggle', 'reasoning');
    await delay(700);  appendLog(logEl, 'browser_click({ element: "Desk Lamp" })', 'command');
    turnOnDeskLamp();
    await delay(800);  appendLog(logEl, 'browser_click({ element: "Curtains → Close" })', 'command');
    closeCurtains();
    await delay(1200); appendLog(logEl, 'browser_snapshot()', 'command');
    await delay(700);  appendLog(logEl, '✓ All states verified', 'success');

    await delay(700);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict warn">⚠ Agent had to understand the UI first</div>
      <div class="verdict success" style="margin-top:8px">✅ Success</div>
      ${timelineHtml([{label:'snapshot',type:'neutral'},{label:'reason',type:'neutral'},{label:'click',type:'neutral'},{label:'snapshot',type:'neutral'},{label:'repeat×3',type:'neutral'},{label:'success',type:'ok'}])}
      ${metricsHtml([
        {label:'Snapshots',value:'4'},
        {label:'Actions',value:'8'},
        {label:'Reasoning Steps',value:'5'},
        {label:'Success',value:'✓',cls:'success'},
      ])}
      <div class="message">"The agent can use the browser, but it still needs to understand the UI."</div>`;

    runBtn.disabled = false;
  }
};

// ── Stage 4: WebMCP ────────────────────────────────────────────────────────

const stage4 = {
  id:'webmcp', number:4, label:'WebMCP', color:'var(--cyan)',
  speakerNote: 'The agent no longer needs to understand the UI. The application exposes capabilities directly.',

  render(container: HTMLElement) {
    const { status, message } = webMcpStatus;
    const toolChips = WEBMCP_TOOLS.map(t => `<span class="webmcp-tool-chip">${t.name}</span>`).join('');
    container.innerHTML = `<div class="stage-panel" style="--stage-color:var(--cyan)">
      <span class="stage-badge">Stage 4 of 5</span>
      <h2 class="stage-title">WebMCP</h2>
      ${promptBox()}
      ${archFlow(['Prompt','LLM','Tool Discovery','Capability Call','Application Logic'], 2)}
      <div class="webmcp-real-integration">
        <div class="webmcp-real-integration-title">Real WebMCP Integration</div>
        <div class="webmcp-real-integration-api">navigator.modelContext.registerTool(…)</div>
        <span id="webmcp-status-badge" class="webmcp-status-badge ${status}">${message}</span>
        <div class="webmcp-real-integration-tools">${toolChips}</div>
      </div>
      <button class="run-btn" id="run-btn">▶ Run WebMCP</button>
      <div class="log-stream" id="log-stream" hidden></div>
      <div class="results"   id="results"    hidden></div>
      ${speakerNote('The agent no longer needs to understand the UI. The application exposes capabilities directly.')}
    </div>`;

    container.querySelector('#run-btn')!.addEventListener('click', () => stage4.run(container));
    container.querySelector('.speaker-notes-toggle')!.addEventListener('click', function() {
      const note = container.querySelector('.speaker-note-text') as HTMLElement;
      note.hidden = !note.hidden;
    });
  },

  async run(container: HTMLElement) {
    const runBtn = container.querySelector('#run-btn') as HTMLButtonElement;
    const logEl  = container.querySelector('#log-stream') as HTMLElement;
    const results = container.querySelector('#results') as HTMLElement;
    runBtn.disabled = true;
    logEl.innerHTML = '';
    results.hidden  = true;
    logEl.hidden    = false;
    resetRoom();

    // Phase 1: Tool Discovery
    await delay(300);  appendLog(logEl, '◆ Phase 1: Tool Discovery', 'phase-head');
    await delay(500);  appendLog(logEl, '✓ turnOnComputer()', 'success');
    await delay(300);  appendLog(logEl, '✓ turnOffRoomLight()', 'success');
    await delay(300);  appendLog(logEl, '✓ turnOnDeskLamp()', 'success');
    await delay(300);  appendLog(logEl, '✓ closeCurtains()', 'success');
    await delay(300);  appendLog(logEl, '✓ setRoomMode(mode)', 'success');

    // Phase 2: Agent Reasoning
    await delay(600);  appendLog(logEl, '◆ Phase 2: Agent Reasoning', 'phase-head');
    await delay(400);  appendLog(logEl, '[need] computer ON', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] room light OFF', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] desk lamp ON', 'reasoning');
    await delay(300);  appendLog(logEl, '[need] curtains CLOSED', 'reasoning');
    await delay(400);  appendLog(logEl, '[decision] setRoomMode covers all requirements', 'reasoning');

    // Phase 3: Tool Call
    await delay(600);  appendLog(logEl, '◆ Phase 3: Tool Call', 'phase-head');
    await delay(400);  appendLog(logEl, '{ "tool": "setRoomMode", "args": { "mode": "night-coding" } }', 'command');

    // Phase 4: Instant room update
    await delay(700);  appendLog(logEl, '◆ Phase 4: Execution', 'phase-head');
    await delay(400);  appendLog(logEl, 'setRoomMode("night-coding")', 'command');
    setRoomMode('night-coding');   // ← The moment. Everything changes at once.
    await delay(500);  appendLog(logEl, '✓ Room prepared successfully', 'success');

    await delay(800);
    results.hidden = false;
    results.innerHTML = `
      <div class="verdict success">✅ Room Prepared Successfully</div>
      ${timelineHtml([{label:'discover tools',type:'ok'},{label:'call tool',type:'ok'},{label:'success',type:'ok'}])}
      ${metricsHtml([
        {label:'Tool Calls',value:'1',cls:'success'},
        {label:'Reasoning Steps',value:'1',cls:'success'},
        {label:'Success',value:'✓',cls:'success'},
        {label:'Time',value:'<1s',cls:'success'},
      ])}

      <div class="section-sep"></div>

      <!-- The critical visual: what each approach sees -->
      <div class="arch-label" style="margin-bottom:8px">What Each Approach Sees</div>
      <div class="sees-comparison">
        <div class="sees-card playwright">
          <div class="sees-card-header">Playwright MCP Sees</div>
          <div class="sees-card-body">&lt;canvas /&gt;</div>
        </div>
        <div class="sees-card webmcp">
          <div class="sees-card-header">WebMCP Sees</div>
          <div class="sees-card-body">
            ${WEBMCP_TOOLS.map(t => `<div class="sees-fn">${t.name}()</div>`).join('')}
          </div>
        </div>
      </div>

      <div class="section-sep"></div>

      <!-- Real-world comparison -->
      <div class="comparison-section">
        <div class="comparison-label">Real World Examples</div>
        <div class="comparison-grid">
          <div class="comparison-card playwright">
            <div class="comparison-card-title">Playwright MCP</div>
            <ul>
              <li>Login flows</li>
              <li>Forms &amp; CRUD</li>
              <li>Admin panels</li>
              <li>DOM-based UI</li>
            </ul>
          </div>
          <div class="comparison-card webmcp">
            <div class="comparison-card-title">WebMCP</div>
            <ul>
              <li>Three.js / WebGL</li>
              <li>Figma &amp; Canva</li>
              <li>VS Code</li>
              <li>Maps &amp; Canvas</li>
            </ul>
          </div>
        </div>
        <p class="comparison-caption">WebMCP becomes most valuable when the UI is no longer represented by the DOM.</p>
      </div>

      <div class="section-sep"></div>

      <!-- WOW moment: time comparison -->
      <div class="wow-moment">
        <div class="wow-counters">
          <div class="wow-counter manual">
            <div class="wow-counter-label">Manual</div>
            <div class="wow-counter-value" id="c-manual">0s</div>
          </div>
          <div class="wow-counter pw">
            <div class="wow-counter-label">Playwright</div>
            <div class="wow-counter-value">∞</div>
          </div>
          <div class="wow-counter pwmcp">
            <div class="wow-counter-label">PW MCP</div>
            <div class="wow-counter-value" id="c-pwmcp">0s</div>
          </div>
          <div class="wow-counter webmcp">
            <div class="wow-counter-label">WebMCP</div>
            <div class="wow-counter-value">&lt;1s</div>
          </div>
        </div>
        <div class="wow-tagline">Same Prompt. Same Application.<br><span>Different Communication Model.</span></div>
      </div>`;

    // Animate the counters
    setTimeout(() => {
      const cm = results.querySelector('#c-manual') as HTMLElement | null;
      const cp = results.querySelector('#c-pwmcp')  as HTMLElement | null;
      if (cm) countUp(cm, 15, 1200, 's');
      if (cp) countUp(cp, 8,  1000, 's');
    }, 400);

    runBtn.disabled = false;
  }
};

// ── Final Slide ────────────────────────────────────────────────────────────

function renderFinalSlide() {
  const el = document.createElement('div');
  el.id = 'final-slide';
  el.setAttribute('hidden','');
  el.innerHTML = `
    <button class="final-close-btn" id="final-close">✕ Back</button>
    <p class="final-slide-subtitle">The Evolution of Agent Communication</p>
    <h1 class="final-slide-title">The Prompt Never Changed</h1>
    <div class="final-slide-prompt">"Prepare the room for night coding"</div>
    <div class="final-columns">
      <div class="final-col col-manual">
        <div class="final-col-icon">❌</div>
        <div class="final-col-title">Manual Automation</div>
        <ul>
          <li>❌ Pixels</li>
          <li>❌ Coordinates</li>
          <li>❌ Fragile</li>
        </ul>
      </div>
      <div class="final-col col-pw">
        <div class="final-col-icon">❌</div>
        <div class="final-col-title">Traditional Playwright</div>
        <ul>
          <li>❌ Selectors</li>
          <li>❌ Nothing in DOM</li>
          <li>❌ Timeout</li>
        </ul>
      </div>
      <div class="final-col col-pwmcp">
        <div class="final-col-icon">⚠️</div>
        <div class="final-col-title">Playwright MCP</div>
        <ul>
          <li>⚠ Understand UI</li>
          <li>⚠ Snapshots</li>
          <li>⚠ Multiple Steps</li>
        </ul>
      </div>
      <div class="final-col col-webmcp">
        <div class="final-col-icon">✅</div>
        <div class="final-col-title">WebMCP</div>
        <ul>
          <li>✅ Capabilities</li>
          <li>✅ Tool Discovery</li>
          <li>✅ Direct Actions</li>
        </ul>
      </div>
    </div>
    <p class="final-footer">
      Stop teaching agents <strong>where to click</strong>.<br>
      Start teaching applications <strong>how to communicate</strong>.
    </p>`;
  document.body.appendChild(el);

  el.querySelector('#final-close')!.addEventListener('click', () => {
    el.setAttribute('hidden','');
  });
}
renderFinalSlide();

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Navigation
// ═══════════════════════════════════════════════════════════════════════════

const allStages = [stage1, stage2, stage3, stage4];
type Stage = typeof stage1;

let currentIndex = 0;

function renderStage(index: number) {
  currentIndex = Math.max(0, Math.min(index, allStages.length-1));
  const stage = allStages[currentIndex];
  resetRoom();

  if ('startViewTransition' in document) {
    (document as Document & { startViewTransition(cb:()=>void): void }).startViewTransition(() => {
      stage.render(panel);
    });
  } else {
    stage.render(panel);
  }

  updateProgress();
}

function updateProgress() {
  const track = document.getElementById('progress-track')!;
  const labels = ['Manual','Playwright','Playwright MCP','WebMCP','Agent-Ready'];
  track.innerHTML = labels.map((label, i) => {
    const isFinal = i === labels.length-1;
    const isDone  = i < currentIndex;
    const isActive = i === currentIndex && !isFinal;
    return `
      ${i > 0 ? '<span class="progress-arrow">→</span>' : ''}
      <span class="progress-step ${isActive?'active':''} ${isDone?'done':''}"
            data-idx="${i}" ${isFinal?'data-final':''}>${label}</span>`;
  }).join('');

  track.querySelectorAll('.progress-step').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt((el as HTMLElement).dataset.idx ?? '0');
      if ((el as HTMLElement).dataset.final !== undefined) {
        showFinalSlide();
      } else {
        renderStage(idx);
      }
    });
  });
}

function showFinalSlide() {
  document.getElementById('final-slide')!.removeAttribute('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — Event Listeners
// ═══════════════════════════════════════════════════════════════════════════

document.getElementById('btn-prev')!.addEventListener('click', () => renderStage(currentIndex-1));
document.getElementById('btn-next')!.addEventListener('click', () => renderStage(currentIndex+1));

document.getElementById('btn-reset')!.addEventListener('click', () => {
  resetRoom();
  renderStage(currentIndex);
});

document.getElementById('btn-speaker')!.addEventListener('click', () => {
  if (document.body.hasAttribute('data-speaker')) {
    document.body.removeAttribute('data-speaker');
  } else {
    document.body.setAttribute('data-speaker','');
  }
});

document.getElementById('btn-final')!.addEventListener('click', showFinalSlide);

// Keyboard: ← → Space
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'ArrowLeft')                 renderStage(currentIndex-1);
  if (e.key === 'ArrowRight' || e.key===' ') { e.preventDefault(); renderStage(currentIndex+1); }
  if (e.key === 'Escape') document.getElementById('final-slide')!.setAttribute('hidden','');
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — Resize + Render Loop
// ═══════════════════════════════════════════════════════════════════════════

function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener('resize', onResize);

// Init
renderStage(0);
onResize();
registerWebMcpTools();
console.info('[SmartRoom] Debug API ready. Try:\n  window.smartRoom.setRoomMode("night-coding")\n  window.smartRoom.getState()');

let lastTime = 0;
function renderLoop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  updateTweens(dt);
  composer.render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);
