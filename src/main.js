import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import './style.css';

const BUILDINGS_MODEL_PATH = '/assets/buildings_connected_highRes.glb';

const app = document.querySelector('#app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Distance limits for scroll-wheel/pinch zoom — OrbitControls' own built-in
// dolly. The on-screen zoom controls are a separate, walk-style movement
// (see the arrow key / zoom section below) and aren't bound by these.
controls.minDistance = 0.15; // just past the camera's near-clip plane (0.1)
controls.maxDistance = 50;

// Renders the floating number labels above hotspot markers, layered over
// the WebGL canvas. It never intercepts mouse events (pointer-events:
// none), so raycasting/dragging on the canvas underneath is unaffected.
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
app.appendChild(labelRenderer.domElement);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// Image-based ambient lighting: lights the model evenly from every
// direction (like a softly lit room), so no facade is left dark no
// matter which way it faces.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

// Holds every loaded model so the camera can be framed to fit all of them.
const content = new THREE.Group();
scene.add(content);

function centerObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  object.position.sub(box.getCenter(new THREE.Vector3()));
}

function frameCamera() {
  const box = new THREE.Box3().setFromObject(content);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  const distance = size > 0 ? size * 0.9 : 5;

  // Straight-on view facing the front of the building (+Z side), instead
  // of a diagonal corner view. If this ends up showing the back or a
  // side, flip the sign on center.z + distance (use "- distance") or
  // swap z for x here.
  camera.position.set(center.x, center.y + distance * 0.3, center.z + distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}

const BUILDINGS_TARGET_SIZE = 6; // world-space diagonal the buildings model gets scaled to
const BUILDINGS_OFFSET_X = 0;

// Everything (the scene, the logo, the on-screen controls) stays hidden —
// see the `body.loading` rules in style.css — until this runs, leaving only
// the centered, pulsing "Loading" text visible.
function finishLoading() {
  document.body.classList.remove('loading');
}

function loadBuildings() {
  new GLTFLoader().load(
    BUILDINGS_MODEL_PATH,
    (gltf) => {
      const root = gltf.scene;

      const rawBox = new THREE.Box3().setFromObject(root);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const scale = BUILDINGS_TARGET_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-6);
      root.scale.setScalar(scale);

      centerObject(root);
      root.position.x += BUILDINGS_OFFSET_X;

      content.add(root);
      frameCamera();
      finishLoading();
    },
    undefined,
    (err) => {
      console.error(`Could not load ${BUILDINGS_MODEL_PATH}:`, err);
      finishLoading();
    }
  );
}

loadBuildings();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  depthTarget.setSize(window.innerWidth, window.innerHeight);
});

// --- Clickable hotspots ---------------------------------------------------
// Each hotspot is a small marker placed in the scene. Clicking one swaps in
// a different 3D asset, framed by the camera. Fill in `assetPath` (and
// `position`) for each entry by hand.

// Loaded from hotspots.json and saved back out through the S-key export.
// `audioPath` is optional — when set, that track plays (looping) as soon as
// the hotspot's asset appears, and stops when you close it.
const HOTSPOTS = [
  {
    id: 'hotspot-1',
    position: new THREE.Vector3(-0.01, 0.10, 0.73),
    assetPath: '/assets/painting_highRes.glb',
    audioPath: '/assets/Audio/weCannotResist.mp3',
  },
  {
    id: 'hotspot-2',
    position: new THREE.Vector3(-0.58, -0.54, 0.27),
    assetPath: '/assets/saelia_highRes.glb',
    audioPath: '/assets/Audio/uncatena.mp3',
  },
  {
    id: 'hotspot-3',
    position: new THREE.Vector3(1.36, -0.50, -1.15),
    assetPath: '/assets/trees_highRes.glb',
    audioPath: '/assets/Audio/vampireEmpire.mp3',
  },
  {
    id: 'hotspot-4',
    position: new THREE.Vector3(1.25, -0.51, 0.55),
    assetPath: '/assets/bugHouse_highRes.glb',
    audioPath: '/assets/Audio/sideboob.mp3',
  },
  {
    id: 'hotspot-5',
    position: new THREE.Vector3(-0.78, 0.12, -2.00),
    assetPath: '/assets/pots_highRes.glb',
    extraAssetPaths: ['/assets/kiln_highRes.glb'],
    audioPath: '/assets/Audio/wakeMeUpToDrive.mp3',
  },
];

const hud = document.querySelector('#hotspot-hud');
function showHudMessage(text) {
  if (hud) hud.textContent = text;
}
showHudMessage('Click a marker to open its asset.');

const HOTSPOT_MARKER_SIZE = 0.0225; // 1/4 of 0.09

const hotspotMarkers = new THREE.Group();
scene.add(hotspotMarkers);

// Draws a flat "?" badge (dark circle, yellow ring + glyph) onto a canvas,
// used as the marker's texture so it reads as a flat 2D icon rather than a
// shaded 3D sphere.
function createQuestionMarkTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffcc00';
  ctx.stroke();

  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 72px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', size / 2, size / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const hotspotMaterial = new THREE.MeshBasicMaterial({
  map: createQuestionMarkTexture(),
  transparent: true,
  side: THREE.DoubleSide,
});

// Flat list of marker meshes, kept in sync with hotspotMarkers' children —
// used as a plain array (not a Group) for raycasting against, so pushing to
// it later (as new hotspots are dropped) keeps new markers clickable
// automatically. It also drives per-frame billboarding (see
// updateMarkerBillboards) so every flat "?" disc keeps facing the camera as
// you move around.
const hotspotMarkerList = [];

function addHotspotMarker(hotspot) {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(HOTSPOT_MARKER_SIZE, 32),
    hotspotMaterial
  );
  marker.position.copy(hotspot.position);
  marker.userData.hotspot = hotspot;
  hotspotMarkers.add(marker);
  hotspotMarkerList.push(marker);

  // Number label floating above the marker. Parented to it, so it tracks
  // the marker's position automatically — including while dragging.
  const labelDiv = document.createElement('div');
  labelDiv.className = 'hotspot-label';
  labelDiv.textContent = hotspot.id.replace('hotspot-', '');
  const label = new CSS2DObject(labelDiv);
  label.position.set(0, HOTSPOT_MARKER_SIZE * 4, 0);
  marker.add(label);
  marker.userData.label = label;
}

function updateMarkerBillboards() {
  for (const marker of hotspotMarkerList) {
    marker.quaternion.copy(camera.quaternion);
  }
}

for (const hotspot of HOTSPOTS) addHotspotMarker(hotspot);

// Holds whichever asset a hotspot has swapped in, separate from `content`
// so opening/closing a hotspot never touches the building model.
const activeAsset = new THREE.Group();
scene.add(activeAsset);

const gltfLoader = new GLTFLoader();
const loadedHotspotAssets = new Map(); // assetPath -> gltf.scene, cached after first load

function loadGltf(assetPath) {
  if (loadedHotspotAssets.has(assetPath)) {
    return Promise.resolve(loadedHotspotAssets.get(assetPath));
  }
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      assetPath,
      (gltf) => {
        loadedHotspotAssets.set(assetPath, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      reject
    );
  });
}

// Plays a hotspot's audioPath (if it has one) alongside its asset. One
// shared Audio object so starting a new track always stops the last one.
const audioListener = new THREE.AudioListener();
camera.add(audioListener);
const hotspotAudio = new THREE.Audio(audioListener);
const audioLoader = new THREE.AudioLoader();
const loadedAudioBuffers = new Map(); // audioPath -> AudioBuffer, cached after first load

function playHotspotAudio(audioPath) {
  if (hotspotAudio.isPlaying) hotspotAudio.stop();
  if (!audioPath) return;

  const play = (buffer) => {
    hotspotAudio.setBuffer(buffer);
    hotspotAudio.setLoop(true);
    hotspotAudio.play();
  };

  if (loadedAudioBuffers.has(audioPath)) {
    play(loadedAudioBuffers.get(audioPath));
    return;
  }

  audioLoader.load(
    audioPath,
    (buffer) => {
      loadedAudioBuffers.set(audioPath, buffer);
      play(buffer);
    },
    undefined,
    (err) => console.error(`Could not load ${audioPath}:`, err)
  );
}

function stopHotspotAudio() {
  if (hotspotAudio.isPlaying) hotspotAudio.stop();
}

let isolatedView = false;
const closeAssetButton = document.querySelector('#close-asset');

// Hides the building and every hotspot marker, drops the background to
// black, and slowly auto-rotates the camera around the swapped-in asset
// so it reads as the only thing in the scene.
function enterIsolatedView(object) {
  content.visible = false;
  hotspotMarkers.visible = false;
  scene.background.set(0x000000);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2; // slow spin
  isolatedView = true;
  if (closeAssetButton) closeAssetButton.hidden = false;

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  const distance = size > 0 ? size * 0.9 : 3;

  camera.position.set(center.x, center.y + distance * 0.3, center.z + distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}

function exitIsolatedView() {
  content.visible = true;
  hotspotMarkers.visible = true;
  scene.background.set(0x1a1a1a);
  controls.autoRotate = false;
  isolatedView = false;
  if (closeAssetButton) closeAssetButton.hidden = true;
}

// When a hotspot has more than one asset (see `extraAssetPaths`), each one
// gets normalized to this world-space size and lined up side by side — the
// individual GLBs weren't authored at matching scales, so without this a
// hotspot showing e.g. pots + kiln together could end up with one asset
// dwarfing the other.
const MULTI_ASSET_TARGET_SIZE = 2;
const MULTI_ASSET_GAP = 0.4;

function showHotspotAsset(hotspot) {
  const paths = [hotspot.assetPath, ...(hotspot.extraAssetPaths || [])];

  const onLoaded = (roots) => {
    activeAsset.clear();

    if (roots.length === 1) {
      activeAsset.add(roots[0].clone(true));
    } else {
      let offsetX = 0;
      for (const root of roots) {
        const clone = root.clone(true);
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = MULTI_ASSET_TARGET_SIZE / Math.max(size.x, size.y, size.z, 1e-6);

        clone.position.sub(center);
        const scaledGroup = new THREE.Group();
        scaledGroup.add(clone);
        scaledGroup.scale.setScalar(scale);

        const scaledWidth = size.x * scale;
        scaledGroup.position.x = offsetX + scaledWidth / 2;
        offsetX += scaledWidth + MULTI_ASSET_GAP;

        activeAsset.add(scaledGroup);
      }
    }

    enterIsolatedView(activeAsset);
    playHotspotAudio(hotspot.audioPath);
    showHudMessage(`Loaded ${paths.join(', ')}. Press Escape to go back.`);
  };

  showHudMessage(`Loading ${paths.join(', ')}...`);
  Promise.all(paths.map(loadGltf))
    .then(onLoaded)
    .catch((err) => {
      console.error(`Could not load one of: ${paths.join(', ')}`, err);
      showHudMessage(`Could not load ${paths.join(', ')} (see console for details).`);
    });
}

function closeHotspotAsset() {
  if (activeAsset.children.length === 0) return;
  activeAsset.clear();
  exitIsolatedView();
  stopHotspotAudio();
  frameCamera();
  showHudMessage('Click a marker to open its asset.');
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeHotspotAsset();
});

if (closeAssetButton) {
  closeAssetButton.addEventListener('click', closeHotspotAsset);
}

// Press S to download the current hotspots as a JSON file — the in-memory
// HOTSPOTS array (and every marker you've placed/dragged) only lives in
// this browser tab and is lost on refresh, so this is how you get the
// positions out to make them permanent (paste them into HOTSPOTS above,
// or hand the file back to whoever's editing the code for you).
function exportHotspots() {
  const data = HOTSPOTS.map((h) => ({
    id: h.id,
    position: { x: h.position.x, y: h.position.y, z: h.position.z },
    assetPath: h.assetPath,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hotspots.json';
  a.click();
  URL.revokeObjectURL(url);
  showHudMessage(`Downloaded hotspots.json (${HOTSPOTS.length} hotspot${HOTSPOTS.length === 1 ? '' : 's'}).`);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 's' || event.key === 'S') exportHotspots();
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(hotspotMarkers, true).length > 0;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'auto';
});

renderer.domElement.addEventListener('click', (event) => {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);

  const hotspotHit = raycaster.intersectObject(hotspotMarkers, true)[0];
  if (window.__debugClick) {
    console.log(
      `click at (${event.clientX},${event.clientY}) hit=${hotspotHit ? hotspotHit.object.userData.hotspot.id : 'none'}`
    );
  }
  if (hotspotHit) {
    showHotspotAsset(hotspotHit.object.userData.hotspot);
  }
});

// --- Arrow key / zoom navigation -------------------------------------------
// Up/Down walk forward/backward, Left/Right strafe sideways. Mouse drag
// (OrbitControls) still rotates the view around the current target.
//
// "Zoom" (the on-screen bar/buttons, and +/- here) is just this same
// forward/backward walk, not a separate dolly-toward-a-fixed-point control —
// it drives this exact moveState.forward, so it moves you continuously
// through the scene for as long as it's held, the same as Up/Down.

const MOVE_SPEED = 1.5; // world units per second

const moveState = { forward: 0, right: 0 };
const FORWARD_KEYS = new Set(['ArrowUp', '+', '=']); // '=' is '+' without needing Shift on most keyboards
const BACKWARD_KEYS = new Set(['ArrowDown', '-', '_']);
const MOVE_KEYS = new Set([...FORWARD_KEYS, ...BACKWARD_KEYS, 'ArrowLeft', 'ArrowRight']);

window.addEventListener('keydown', (event) => {
  if (!MOVE_KEYS.has(event.key)) return;
  event.preventDefault();
  if (FORWARD_KEYS.has(event.key)) moveState.forward = 1;
  if (BACKWARD_KEYS.has(event.key)) moveState.forward = -1;
  if (event.key === 'ArrowLeft') moveState.right = -1;
  if (event.key === 'ArrowRight') moveState.right = 1;
});

window.addEventListener('keyup', (event) => {
  if (!MOVE_KEYS.has(event.key)) return;
  if (FORWARD_KEYS.has(event.key) || BACKWARD_KEYS.has(event.key)) moveState.forward = 0;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') moveState.right = 0;
});

const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveOffset = new THREE.Vector3();

function updateMovement(delta) {
  if (isolatedView) return; // stay put and let the object spin while it's in view
  if (moveState.forward === 0 && moveState.right === 0) return;

  camera.getWorldDirection(moveForward);
  moveForward.y = 0;
  moveForward.normalize();
  moveRight.crossVectors(moveForward, camera.up);

  moveOffset
    .set(0, 0, 0)
    .addScaledVector(moveForward, moveState.forward)
    .addScaledVector(moveRight, moveState.right)
    .normalize()
    .multiplyScalar(MOVE_SPEED * delta);

  camera.position.add(moveOffset);
  controls.target.add(moveOffset);
}

// --- On-screen tilt buttons ------------------------------------------------
// Up/Down/Left/Right buttons that orbit the camera around the current
// OrbitControls target, exactly like dragging the mouse would — held down
// (mouse or touch), the view keeps tilting until released.

const TILT_SPEED = 0.3; // radians per second
const TILT_POLAR_EPSILON = 0.001; // keep just short of the poles, where lookAt() gets unstable

const tiltState = { yaw: 0, pitch: 0 };
const tiltOffset = new THREE.Vector3();
const tiltSpherical = new THREE.Spherical();

const TILT_BUTTONS = [
  { id: 'tilt-up', pitch: 1, yaw: 0 },
  { id: 'tilt-down', pitch: -1, yaw: 0 },
  { id: 'tilt-left', pitch: 0, yaw: 1 },
  { id: 'tilt-right', pitch: 0, yaw: -1 },
];

for (const { id, pitch, yaw } of TILT_BUTTONS) {
  const button = document.querySelector(`#${id}`);
  if (!button) continue;

  const start = (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    tiltState.pitch = pitch;
    tiltState.yaw = yaw;
  };
  const stop = () => {
    tiltState.pitch = 0;
    tiltState.yaw = 0;
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('pointerleave', stop);
}

function updateTilt(delta) {
  if (isolatedView) return; // camera is auto-rotating around the isolated asset instead
  if (tiltState.yaw === 0 && tiltState.pitch === 0) return;

  tiltOffset.copy(camera.position).sub(controls.target);
  tiltSpherical.setFromVector3(tiltOffset);
  tiltSpherical.theta -= tiltState.yaw * TILT_SPEED * delta;
  tiltSpherical.phi -= tiltState.pitch * TILT_SPEED * delta;
  tiltSpherical.phi = THREE.MathUtils.clamp(
    tiltSpherical.phi,
    TILT_POLAR_EPSILON,
    Math.PI - TILT_POLAR_EPSILON
  );

  tiltOffset.setFromSpherical(tiltSpherical);
  camera.position.copy(controls.target).add(tiltOffset);
  camera.lookAt(controls.target);
}

// --- Movement joystick -------------------------------------------------
// One draggable pad, replacing the old zoom bar/buttons: drag up/down to
// walk forward/back (this is what "zoom" already meant — see the arrow key
// section above), drag left/right to strafe — closing the gap where strafe
// had no screen/mouse equivalent before. Driving the exact same
// moveState.forward/right that the keyboard uses means this needs no
// changes to updateMovement() at all.

const moveJoystick = document.querySelector('#move-joystick');
const moveJoystickThumb = document.querySelector('#move-joystick-thumb');
const MOVE_JOYSTICK_RADIUS = 40; // px the thumb can travel from center before clamping

if (moveJoystick && moveJoystickThumb) {
  let joystickPointerId = null;

  const updateFromEvent = (event) => {
    const rect = moveJoystick.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > MOVE_JOYSTICK_RADIUS) {
      dx = (dx / distance) * MOVE_JOYSTICK_RADIUS;
      dy = (dy / distance) * MOVE_JOYSTICK_RADIUS;
    }
    moveJoystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    moveState.right = dx / MOVE_JOYSTICK_RADIUS;
    moveState.forward = -dy / MOVE_JOYSTICK_RADIUS; // up on the pad = forward
  };

  // Snaps back to center and stops moving on release — a rocker you hold,
  // not a position you leave it at, same as letting go of an arrow key.
  const stopJoystick = () => {
    joystickPointerId = null;
    moveJoystickThumb.style.transform = 'translate(0, 0)';
    moveState.forward = 0;
    moveState.right = 0;
  };

  moveJoystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    joystickPointerId = event.pointerId;
    moveJoystick.setPointerCapture(event.pointerId);
    updateFromEvent(event);
  });
  moveJoystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointerId) return;
    updateFromEvent(event);
  });
  moveJoystick.addEventListener('pointerup', stopJoystick);
  moveJoystick.addEventListener('pointercancel', stopJoystick);
}

// --- Idle reset -------------------------------------------------------------
// A minute with no interaction (mouse, touch, wheel, or keyboard) puts the
// view back to how it started: closes any open hotspot asset and re-frames
// the whole building, so an unattended session doesn't stay stuck wherever
// the last visitor left it.

const IDLE_RESET_SECONDS = 60;
let lastInteractionTime = performance.now();
let idleResetDone = false;

function markInteraction() {
  lastInteractionTime = performance.now();
  idleResetDone = false;
}

for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) {
  window.addEventListener(type, markInteraction, { passive: true });
}

function resetToDefaultState() {
  if (activeAsset.children.length > 0) {
    closeHotspotAsset(); // clears the isolated asset, stops its audio, re-frames the building
  } else {
    frameCamera();
  }
  moveState.forward = 0;
  moveState.right = 0;
  tiltState.yaw = 0;
  tiltState.pitch = 0;
}

function updateIdleReset() {
  if (idleResetDone) return;
  if ((performance.now() - lastInteractionTime) / 1000 < IDLE_RESET_SECONDS) return;
  idleResetDone = true;
  resetToDefaultState();
}

// Hides a marker's number label whenever something sits between the camera
// and the marker — CSS2DObjects are plain HTML overlays and don't respect
// the WebGL depth buffer on their own, so without this the numbers would
// show straight through walls even when their dot is hidden behind one.
//
// A raycast against `content` was tried first, but this building is a raw
// photogrammetry scan (noisy, overlapping, non-watertight geometry) rather
// than clean CAD walls — a ray toward a marker's exact position tends to
// clip nearby scan noise at roughly the same distance as genuine occluding
// walls, so no fixed distance threshold could tell them apart reliably.
// Reading back the actual rendered depth buffer sidesteps that entirely: it
// asks "what did the GPU decide is closest at this exact pixel", which is
// the same question rendering already answers correctly.
const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
const depthTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const depthPixel = new Uint8Array(4);
const markerWorldPos = new THREE.Vector3();

// Matches three.js's own unpackRGBAToDepth() shader function, so the bytes
// read back here decode the same way they were packed by MeshDepthMaterial.
const UNPACK_FACTORS = [255 / 256, (255 / 256) / 256, (255 / 256) / (256 * 256), 1 / (256 * 256 * 256)];
function unpackRGBAToDepth(r, g, b, a) {
  return r * UNPACK_FACTORS[0] + g * UNPACK_FACTORS[1] + b * UNPACK_FACTORS[2] + a * UNPACK_FACTORS[3];
}

const DEPTH_EPSILON = 0.0015; // tolerance for float/8-bit packing precision

function updateHotspotLabelVisibility() {
  if (!hotspotMarkers.visible) return;

  const width = depthTarget.width;
  const height = depthTarget.height;

  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(depthTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;

  for (const marker of hotspotMarkerList) {
    const label = marker.userData.label;
    if (!label) continue;

    marker.getWorldPosition(markerWorldPos);
    const ndc = markerWorldPos.clone().project(camera);

    if (ndc.z < -1 || ndc.z > 1 || ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) {
      label.visible = false; // behind the camera or off-screen
      continue;
    }

    const px = Math.min(width - 1, Math.max(0, Math.round((ndc.x * 0.5 + 0.5) * width)));
    const pyTop = Math.round((1 - (ndc.y * 0.5 + 0.5)) * height);
    const pyGL = Math.min(height - 1, Math.max(0, height - 1 - pyTop)); // readback uses GL's bottom-left origin

    renderer.readRenderTargetPixels(depthTarget, px, pyGL, 1, 1, depthPixel);
    const sceneDepth = unpackRGBAToDepth(depthPixel[0] / 255, depthPixel[1] / 255, depthPixel[2] / 255, depthPixel[3] / 255);
    const markerDepth = ndc.z * 0.5 + 0.5;

    // Visible if the marker is the frontmost thing at its own pixel (i.e.
    // nothing else rendered closer there) — small epsilon for the sphere's
    // own radius and packing precision.
    label.visible = markerDepth <= sceneDepth + DEPTH_EPSILON;
    if (window.__debugOcclusion) {
      console.log(
        `${marker.userData.hotspot.id}: px=${px} pyTop=${pyTop} markerDepth=${markerDepth.toFixed(5)} sceneDepth=${sceneDepth.toFixed(5)} visible=${label.visible}`
      );
    }
  }
}

const clock = new THREE.Clock();

// Raycasting against the full (high-res) building mesh for every marker is
// too costly to run every single frame, so this only re-checks occlusion a
// few times a second — plenty responsive for labels, much cheaper overall.
const OCCLUSION_CHECK_INTERVAL = 0.15; // seconds
let occlusionCheckTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateMovement(delta);
  updateTilt(delta);
  controls.update();
  updateIdleReset();
  updateMarkerBillboards();

  occlusionCheckTimer += delta;
  if (occlusionCheckTimer >= OCCLUSION_CHECK_INTERVAL) {
    occlusionCheckTimer = 0;
    updateHotspotLabelVisibility();
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();
