// Little Marlowe in 3D — a cream fuzzy plush (Marlowe's look) with nerdy glasses,
// working a real-data chalkboard in a 3D executive office. ES module; loaded by
// index.html. Exposes window.__lm3d.setData(latestNote, log) for the page script.
//
// Everything on the chalkboard is drawn from live measurements — no canned numbers.

import * as THREE from 'three';

const stage = document.getElementById('lmStage');
if (!stage) throw new Error('lmStage missing');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d12);
scene.fog = new THREE.Fog(0x2a1d12, 18, 34);

const camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.1, 100);
const CAM_BASE = new THREE.Vector3(0.6, 2.9, 11.6);
camera.position.copy(CAM_BASE);
camera.lookAt(0.2, 2.3, -1);

scene.add(new THREE.AmbientLight(0xffe6c4, 0.55));
const key = new THREE.DirectionalLight(0xfff1d8, 1.15);
key.position.set(4, 9, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.25);
rim.position.set(-6, 4, -4);
scene.add(rim);

/* ================= office ================= */
const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 });

const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 13), woodMat);
wall.position.set(0, 5, -3.2);
scene.add(wall);
// wall panel strips
for (let x = -15; x <= 15; x += 3) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 13, 0.06), woodDark);
  strip.position.set(x, 5, -3.15);
  scene.add(strip);
}
// wainscot
const wains = new THREE.Mesh(new THREE.BoxGeometry(34, 1.1, 0.12), woodDark);
wains.position.set(0, 0.55, -3.1);
scene.add(wains);
// floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 6);
scene.add(floor);

/* ---- bookshelf (left) ---- */
{
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.4, 0.9), woodDark);
  frame.position.y = 3.2;
  g.add(frame);
  const bookCols = [0xa33c3c, 0x3c6ea3, 0x3c8a5a, 0xb98a2e, 0x6a4a9e];
  for (let s = 0; s < 3; s++) {
    const y = 1.6 + s * 1.7;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.8), woodMat);
    shelf.position.y = y;
    g.add(shelf);
    for (let b = 0; b < 6; b++) {
      const h = 0.9 + Math.random() * 0.4;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, h, 0.6),
        new THREE.MeshStandardMaterial({ color: bookCols[(s * 6 + b) % bookCols.length], roughness: 0.8 })
      );
      book.position.set(-0.95 + b * 0.36, y + 0.05 + h / 2, 0.05);
      book.rotation.z = (Math.random() - 0.5) * 0.06;
      g.add(book);
    }
  }
  g.position.set(-9.5, 0, -2.2);
  scene.add(g);
}

/* ---- desk + lamp (right) ---- */
{
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.6), woodMat);
  top.position.y = 1.5;
  g.add(top);
  for (const [lx, lz] of [[-1.5, -0.65], [1.5, -0.65], [-1.5, 0.65], [1.5, 0.65]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), woodDark);
    leg.position.set(lx, 0.75, lz);
    g.add(leg);
  }
  // papers
  const papers = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xf5f0dc, roughness: 0.9 }));
  papers.position.set(-0.7, 1.63, 0.1);
  papers.rotation.y = 0.3;
  g.add(papers);
  // lamp
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 20),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.6 }));
  lampBase.position.set(1.0, 1.65, -0.3);
  g.add(lampBase);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 12),
    lampBase.material);
  lampArm.position.set(1.0, 2.2, -0.3);
  lampArm.rotation.z = -0.35;
  g.add(lampArm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.6, side: THREE.DoubleSide }));
  shade.position.set(0.72, 2.72, -0.3);
  shade.rotation.z = 0.5;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
  bulb.position.set(0.66, 2.62, -0.3);
  g.add(bulb);
  const lampLight = new THREE.PointLight(0xffdf9e, 12, 9, 1.6);
  lampLight.position.set(0.66, 2.5, -0.3);
  g.add(lampLight);
  g.position.set(8.2, 0, -1.4);
  g.rotation.y = -0.35;
  scene.add(g);
}

/* ---- gold-record plaque: XRP + BTC coins (replaces the PhD frame) ---- */
function coinTexture(symbol) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(108, 108, 10, 128, 128, 128);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(0.55, '#f0c94e');
  grad.addColorStop(1, '#b98a1e');
  g.fillStyle = grad;
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a6410'; g.lineWidth = 8;
  g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#7a5410';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 84px Georgia, serif';
  g.fillText(symbol, 128, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
{
  const plaque = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4 }));
  plaque.add(back);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.35, metalness: 0.75 }));
  plate.position.z = 0.08;
  plaque.add(plate);
  const coinGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.09, 40);
  const coinMats = (sym) => {
    const face = new THREE.MeshStandardMaterial({ map: coinTexture(sym), roughness: 0.3, metalness: 0.8 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.8 });
    return [edge, face, face];
  };
  const xrp = new THREE.Mesh(coinGeo, coinMats('X'));
  xrp.rotation.x = Math.PI / 2;
  xrp.position.set(-0.72, 0.08, 0.16);
  plaque.add(xrp);
  const btc = new THREE.Mesh(coinGeo, coinMats('₿'));
  btc.rotation.x = Math.PI / 2;
  btc.position.set(0.72, 0.08, 0.16);
  plaque.add(btc);
  // little engraved nameplate
  const plateCv = document.createElement('canvas');
  plateCv.width = 512; plateCv.height = 64;
  const pg = plateCv.getContext('2d');
  pg.fillStyle = '#2a2a30'; pg.fillRect(0, 0, 512, 64);
  pg.fillStyle = '#e8c86a'; pg.textAlign = 'center'; pg.textBaseline = 'middle';
  pg.font = '600 30px Georgia, serif';
  pg.fillText('INFORMATION FLOW · LIVE', 256, 34);
  const plateTex = new THREE.CanvasTexture(plateCv);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  const nameplate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.06),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4, metalness: 0.4 }));
  nameplate.position.set(0, -0.62, 0.12);
  plaque.add(nameplate);
  plaque.position.set(7.6, 5.6, -3.0);
  plaque.rotation.y = -0.18;
  scene.add(plaque);
}

/* ================= chalkboard (real-data canvas texture) ================= */
const boardCanvas = document.createElement('canvas');
boardCanvas.width = 1024;
boardCanvas.height = 600;
const bctx = boardCanvas.getContext('2d');
const boardTex = new THREE.CanvasTexture(boardCanvas);
boardTex.colorSpace = THREE.SRGBColorSpace;
boardTex.anisotropy = 4;

function drawBoard(note, log) {
  const g = bctx, W = 1024, H = 600;
  g.fillStyle = '#232d2a';
  g.fillRect(0, 0, W, H);
  // faint chalk smudges
  g.fillStyle = 'rgba(244,241,228,0.03)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.ellipse(Math.random() * W, Math.random() * H, 20 + Math.random() * 60, 8 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const chalk = 'rgba(244,241,228,0.94)';
  g.fillStyle = chalk;
  g.textAlign = 'center';
  g.font = '52px "Segoe Print", "Bradley Hand", cursive';
  g.fillText("Little Marlowe's findings", W / 2, 78);
  g.strokeStyle = 'rgba(244,241,228,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(80, 108); g.lineTo(W - 80, 108); g.stroke();
  g.textAlign = 'left';
  g.font = '44px "Segoe Print", "Bradley Hand", cursive';
  if (note && note.computed) {
    const c = note.computed;
    g.fillStyle = chalk;
    g.fillText(`TE BTC→XRP   ${c.te_btc_xrp.toFixed(4)} nats`, 80, 190);
    g.fillText(`z = ${c.z_btc_xrp.toFixed(2)}   (need > 2)`, 80, 262);
    g.fillText(`vote: ${c.vote === 0.5 ? 'abstain (0.50)' : 'P(up) = ' + c.vote.toFixed(3)}`, 80, 334);
    const vc = note.verdict === 'useful' ? '#b5e6a2' : note.verdict === 'insufficient data' ? '#c9c9c9' : '#f2c879';
    g.fillStyle = vc;
    g.fillText(`verdict: ${note.verdict}${note.verdict === 'not useful' ? ' — yet' : ''}`, 80, 406);
    // sparkline of recent TE BTC→XRP
    const pts = (log || []).filter((e) => e.computed).slice(-24).map((e) => e.computed.te_btc_xrp);
    if (pts.length > 1) {
      const mn = Math.min(...pts), mx = Math.max(...pts), rg = (mx - mn) || 1;
      const X0 = 80, X1 = W - 80, Y0 = 548, Y1 = 462;
      g.strokeStyle = 'rgba(244,241,228,0.8)';
      g.lineWidth = 3;
      g.beginPath();
      pts.forEach((v, i) => {
        const x = X0 + (X1 - X0) * i / (pts.length - 1);
        const y = Y0 - ((v - mn) / rg) * (Y0 - Y1);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
      g.fillStyle = 'rgba(244,241,228,0.55)';
      g.font = '28px "Segoe Print", "Bradley Hand", cursive';
      g.fillText(`TE BTC→XRP · last ${pts.length} notes`, 80, 448);
    }
  } else {
    g.fillStyle = chalk;
    g.fillText('collecting data…', 80, 220);
    g.fillText('chalk at the ready.', 80, 292);
  }
  boardTex.needsUpdate = true;
}

{
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 6.0, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x7a4f28, roughness: 0.7 }));
  frame.position.set(1.2, 3.4, -2.9);
  scene.add(frame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.4),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }));
  board.position.set(1.2, 3.4, -2.72);
  scene.add(board);
  // chalk tray + chalk + eraser
  const tray = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.14, 0.5), frame.material);
  tray.position.set(1.2, 0.32, -2.75);
  scene.add(tray);
  const chalkStick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4f1e4, roughness: 0.9 }));
  chalkStick.rotation.z = Math.PI / 2;
  chalkStick.position.set(3.6, 0.44, -2.7);
  scene.add(chalkStick);
  const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9 }));
  eraser.position.set(4.4, 0.48, -2.7);
  scene.add(eraser);
}

/* ================= Little Marlowe (3D plush, Marlowe's look) ================= */
const CREAM = 0xf3e9d2, CREAM_FACE = 0xfbf3df;
const furMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.95 });
const faceMat = new THREE.MeshStandardMaterial({ color: CREAM_FACE, roughness: 0.7 });
const blackGloss = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.15, metalness: 0.1 });
const blushMat = new THREE.MeshStandardMaterial({ color: 0xefa3a3, roughness: 0.9, transparent: true, opacity: 0.75 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.4 });

const marlowe = new THREE.Group();

// stack of books he stands on
{
  const cols = [0xa33c3c, 0x3c6ea3, 0x3c8a5a];
  const widths = [1.9, 1.7, 1.5];
  let y = 0;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(widths[i], 0.3, 1.3),
      new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.85 }));
    b.position.y = y + 0.15;
    b.rotation.y = (i - 1) * 0.12;
    marlowe.add(b);
    y += 0.3;
  }
}
const STAND_Y = 0.9;

function ball(r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 28), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// body (plush blob)
const bodyG = new THREE.Group();
bodyG.position.y = STAND_Y;
marlowe.add(bodyG);
bodyG.add(ball(1.0, furMat, 0, 1.05, 0, 0.88, 1.02, 0.82));
// feet
bodyG.add(ball(0.3, furMat, -0.42, 0.12, 0.28, 1, 0.7, 1.25));
bodyG.add(ball(0.3, furMat, 0.42, 0.12, 0.28, 1, 0.7, 1.25));
// smooth face plate
bodyG.add(ball(0.62, faceMat, 0, 1.32, 0.62, 1, 0.95, 0.55));
// eyes (glossy black, like Marlowe)
const eyeL = ball(0.085, blackGloss, -0.22, 1.4, 1.1);
const eyeR = ball(0.085, blackGloss, 0.22, 1.4, 1.1);
bodyG.add(eyeL, eyeR);
// nerdy glasses
{
  const lensGeo = new THREE.TorusGeometry(0.15, 0.028, 12, 28);
  const l = new THREE.Mesh(lensGeo, frameMat);
  l.position.set(-0.22, 1.4, 1.14);
  const r = new THREE.Mesh(lensGeo, frameMat);
  r.position.set(0.22, 1.4, 1.14);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.035), frameMat);
  bridge.position.set(0, 1.4, 1.14);
  const tL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.5), frameMat);
  tL.position.set(-0.4, 1.4, 0.92);
  const tR = tL.clone();
  tR.position.x = 0.4;
  bodyG.add(l, r, bridge, tL, tR);
}
// smile
{
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 24, Math.PI * 0.65), frameMat);
  smile.position.set(0, 1.18, 1.12);
  smile.rotation.z = Math.PI * 1.175;
  bodyG.add(smile);
}
// blush cheeks
bodyG.add(ball(0.09, blushMat, -0.38, 1.26, 1.0, 1, 0.7, 0.4));
bodyG.add(ball(0.09, blushMat, 0.38, 1.26, 1.0, 1, 0.7, 0.4));
// tiny bow tie (executive flair)
{
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 });
  const w1 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), bowMat);
  w1.rotation.z = Math.PI / 2; w1.rotation.y = Math.PI / 4;
  w1.position.set(-0.13, 0.78, 0.78);
  const w2 = w1.clone();
  w2.position.x = 0.13;
  w2.rotation.z = -Math.PI / 2;
  const knot = ball(0.05, bowMat, 0, 0.78, 0.8);
  bodyG.add(w1, w2, knot);
}
// far arm (hangs down)
{
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 6, 14), furMat);
  arm.position.set(-0.88, 0.85, 0.1);
  arm.rotation.z = 0.25;
  bodyG.add(arm);
  bodyG.add(ball(0.15, furMat, -1.0, 0.5, 0.1));
}
// writing arm (pivot at shoulder, animated)
const armWrite = new THREE.Group();
armWrite.position.set(0.78, 1.35, 0.15);
{
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 6, 14), furMat);
  arm.position.set(0.28, -0.2, 0.1);
  arm.rotation.z = -1.15; // reaches out toward the board
  armWrite.add(arm);
  const hand = ball(0.15, furMat, 0.52, -0.32, 0.12);
  armWrite.add(hand);
  const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4f1e4, roughness: 0.9 }));
  chalk.position.set(0.58, -0.42, 0.14);
  chalk.rotation.z = 1.1;
  armWrite.add(chalk);
}
bodyG.add(armWrite);

marlowe.position.set(-4.6, 0, -0.2);
marlowe.rotation.y = 0.85; // three-quarter turn: faces the board, face visible to camera
scene.add(marlowe);

/* ================= animation ================= */
let verdict = 'not useful';
let hopT = -1;
let lastBlink = 0;
let elapsed = 0;
const clock = new THREE.Clock();

function sizeRenderer() {
  const w = Math.max(320, stage.clientWidth || 800);
  const h = Math.round(w * 0.62);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = 'auto';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeRenderer();
window.addEventListener('resize', sizeRenderer);

let running = true;
let onScreen = true;
new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0.05 }).observe(stage);
document.addEventListener('visibilitychange', () => { running = !document.hidden; });

function tick() {
  requestAnimationFrame(tick);
  if (!running || !onScreen) return;
  const dt = Math.min(0.05, clock.getDelta() || 0.016);
  elapsed += dt;
  const t = elapsed;

  // writing motion
  armWrite.rotation.z = Math.sin(t * 5.2) * 0.16;
  armWrite.rotation.x = Math.sin(t * 7.1) * 0.1;
  // gentle bob while he works
  bodyG.position.y = STAND_Y + Math.abs(Math.sin(t * 2.2)) * 0.05;
  bodyG.rotation.y = Math.sin(t * 0.9) * 0.05;
  // blink
  if (t - lastBlink > 4.2) {
    lastBlink = t;
  }
  const blinkPhase = (t - lastBlink) / 0.22;
  const eyeSY = blinkPhase < 1 ? Math.max(0.12, Math.abs(Math.cos(blinkPhase * Math.PI))) : 1;
  eyeL.scale.y = eyeSY;
  eyeR.scale.y = eyeSY;
  // happy hop when he finds something real
  if (hopT >= 0) {
    hopT += dt;
    const k = hopT / 0.9;
    if (k >= 1) { hopT = -1; bodyG.position.y = STAND_Y; }
    else bodyG.position.y = STAND_Y + Math.sin(k * Math.PI) * 0.55;
  }
  // slow cinematic camera sway
  camera.position.x = CAM_BASE.x + Math.sin(t * 0.24) * 0.35;
  camera.position.y = CAM_BASE.y + Math.sin(t * 0.31) * 0.18;
  camera.lookAt(0.2, 2.3, -1);

  renderer.render(scene, camera);
}
tick();

/* ================= live data hook ================= */
let lastVerdict = null;
window.__lm3d = {
  setData(note, log) {
    drawBoard(note, log);
    if (note) {
      verdict = note.verdict;
      if (lastVerdict !== null && lastVerdict !== 'useful' && note.verdict === 'useful') hopT = 0;
      lastVerdict = note.verdict;
    }
    sizeRenderer();
  },
};
drawBoard(null, []);
