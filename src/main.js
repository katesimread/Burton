import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import './style.css';

const MODEL_PATH = '/models/model.obj';
const MATERIAL_PATH = '/models/model.mtl'; // set to null if you don't have one
const AUDIO_PATH = '/audio/click.wav';
const MARKER_MODEL_PATH = '/models/star.obj';
const MARKER_SIZE = 0.6; // world-space diameter the marker model gets scaled to
const MARKER_SPIN_SPEED = 1.2; // radians per second

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

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// --- Clickable audio marker ---------------------------------------------

const listener = new THREE.AudioListener();
camera.add(listener);

const clickSound = new THREE.Audio(listener);
new THREE.AudioLoader().load(
  AUDIO_PATH,
  (buffer) => clickSound.setBuffer(buffer),
  undefined,
  (err) => console.error(`Could not load ${AUDIO_PATH}:`, err)
);

// Holds whatever mesh represents the clickable marker (placeholder sphere
// until the marker model loads, then the loaded model).
const marker = new THREE.Group();
scene.add(marker);

const markerPlaceholder = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff3333 })
);
marker.add(markerPlaceholder);

new OBJLoader().load(
  MARKER_MODEL_PATH,
  (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MARKER_SIZE / Math.max(size.x, size.y, size.z, 1e-6);

    obj.position.sub(center);
    const scaledGroup = new THREE.Group();
    scaledGroup.add(obj);
    scaledGroup.scale.setScalar(scale);

    obj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
      }
    });

    marker.remove(markerPlaceholder);
    marker.add(scaledGroup);
  },
  undefined,
  (err) => {
    console.error(`Could not load ${MARKER_MODEL_PATH}:`, err);
    console.warn('Keeping the placeholder sphere as the marker.');
  }
);

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
  const hit = raycaster.intersectObject(marker, true).length > 0;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'auto';
});

renderer.domElement.addEventListener('click', (event) => {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(marker, true)[0];
  if (!hit) return;

  if (!clickSound.buffer) {
    console.warn(`${AUDIO_PATH} hasn't finished loading yet.`);
    return;
  }
  if (clickSound.isPlaying) clickSound.stop();
  clickSound.play();
});

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const distance = size > 0 ? size * 1.5 : 5;
  camera.position.set(distance, distance * 0.6, distance);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();

  // object is now recentered on the origin — put the marker there too.
  marker.position.copy(
    new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
  );
}

function loadObj() {
  const objLoader = new OBJLoader();

  const onLoaded = (obj) => {
    scene.add(obj);
    frameObject(obj);
  };

  const onError = (err) => {
    console.error(`Could not load ${MODEL_PATH}:`, err);
    console.warn('Showing a placeholder cube instead. Add your .obj to public/models/');
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4488ff, wireframe: true })
    );
    scene.add(placeholder);
    frameObject(placeholder);
  };

  if (MATERIAL_PATH) {
    new MTLLoader().load(
      MATERIAL_PATH,
      (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load(MODEL_PATH, onLoaded, undefined, onError);
      },
      undefined,
      () => {
        // No .mtl found — load the OBJ without materials.
        objLoader.load(MODEL_PATH, onLoaded, undefined, onError);
      }
    );
  } else {
    objLoader.load(MODEL_PATH, onLoaded, undefined, onError);
  }
}

loadObj();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  marker.rotation.y += MARKER_SPIN_SPEED * clock.getDelta();
  renderer.render(scene, camera);
}
animate();
