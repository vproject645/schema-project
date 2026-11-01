import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { stresses } from "../studio/climate";
import { lerpColor, mood, rainSettings, sceneGeometry, wearAt } from "../studio/scene-model";
import type { BuildingSpec, Climate, SimulationResult } from "../studio/types";

type Props = {
  spec: BuildingSpec;
  sim: SimulationResult;
  /** Fractional years since completion. Drives the weathering time-lapse. */
  year: number;
  rain: boolean;
  label: string;
};

interface Runtime {
  rebuild(spec: BuildingSpec): void;
  wear(spec: BuildingSpec, sim: SimulationResult, year: number): void;
  climate(c: Climate, rainOn: boolean): void;
  dispose(): void;
}

const MAX_DROPS = 1600;

function bayTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#33444f";
  g.fillRect(14, 12, 36, 34);
  g.strokeStyle = "#e9eef0";
  g.lineWidth = 3;
  g.strokeRect(14, 12, 36, 34);
  g.beginPath(); g.moveTo(32, 12); g.lineTo(32, 46); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Vertical rain-streak stains. Alpha carries the pattern; opacity is driven by wear. */
function streakTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 128, w = 1 + rnd() * 5, len = 60 + rnd() * 190, a = 0.25 + rnd() * 0.6;
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(x, 0, w, len);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
  });
}

function roofMesh(spec: BuildingSpec, mat: THREE.Material): THREE.Mesh {
  const g = sceneGeometry(spec);
  const w = g.width + 0.8, d = g.depth + 0.8, r = g.roofRise;
  let geo: THREE.BufferGeometry;
  let mesh: THREE.Mesh;
  if (g.roof === "flat") {
    geo = new THREE.BoxGeometry(w, 0.4, d);
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = g.height + 0.2;
  } else if (g.roof === "hip") {
    geo = new THREE.ConeGeometry(w / Math.SQRT2, r, 4);
    mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.scale.z = d / w;
    mesh.position.y = g.height + r / 2;
  } else {
    const s = new THREE.Shape();
    if (g.roof === "gable") { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, r); }
    else { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, r); s.lineTo(-w / 2, r * 0.3); }
    s.closePath();
    geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = g.height;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRuntime(host: HTMLDivElement, onFail: (m: string) => void): Runtime | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    onFail("3D view needs WebGL, which this browser or device did not provide.");
    return null;
  }
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfdbe0, 80, 260);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 8;
  controls.maxDistance = 220;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7560, 0.9);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(40, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  scene.add(hemi, sun);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x7d8f6c, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Rain: line segments, recycled when they hit the ground.
  const rainPos = new Float32Array(MAX_DROPS * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xc4d6de, transparent: true, opacity: 0.55 });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  scene.add(rainLines);
  let rain = { drops: 0, speed: 0, slant: 0, on: false };
  const seedDrops = () => {
    for (let i = 0; i < MAX_DROPS; i++) {
      const x = (Math.random() - 0.5) * 90, y = Math.random() * 34, z = (Math.random() - 0.5) * 90;
      rainPos.set([x, y, z, x, y + 1.1, z], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
  };
  seedDrops();

  const texW = bayTexture(), texD = bayTexture(), streaks = streakTexture();
  const building = new THREE.Group();
  scene.add(building);
  let wallMats: THREE.MeshStandardMaterial[] = [];
  let roofMat = new THREE.MeshStandardMaterial();
  let postMat = new THREE.MeshStandardMaterial();
  let stainMat = new THREE.MeshBasicMaterial();
  let algae = 0;
  let lastSize = 0;

  const fit = (size: number, height: number, force: boolean) => {
    if (!force && Math.abs(size - lastSize) / Math.max(lastSize, 1) < 0.3) return;
    lastSize = size;
    const dist = Math.max(18, size * 2.1);
    camera.position.set(dist * 0.9, dist * 0.55 + height * 0.3, dist * 0.9);
    controls.target.set(0, height * 0.45, 0);
    controls.update();
  };

  const rt: Runtime = {
    rebuild(spec) {
      building.children.slice().forEach((c) => { building.remove(c); disposeObject(c); });
      const g = sceneGeometry(spec);
      texW.repeat.set(g.baysWide, g.storeys);
      texD.repeat.set(g.baysDeep, g.storeys);
      const mk = (map: THREE.Texture | null) => new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.92 });
      const side = [mk(texD), mk(texD), mk(null), mk(null), mk(texW), mk(texW)];
      wallMats = side;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(g.width, g.height, g.depth), side);
      walls.position.y = g.height / 2;
      walls.castShadow = walls.receiveShadow = true;

      streaks.repeat.set(Math.max(1, Math.round(g.width / 5)), 1);
      stainMat = new THREE.MeshBasicMaterial({ map: streaks, transparent: true, opacity: 0, depthWrite: false, color: 0x30382c });
      const stain = new THREE.Mesh(new THREE.BoxGeometry(g.width + 0.06, g.height + 0.06, g.depth + 0.06), stainMat);
      stain.position.y = g.height / 2;

      postMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });
      const post = (x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, g.height, 0.5), postMat);
        m.position.set(x, g.height / 2, z);
        m.castShadow = true;
        return m;
      };
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(g.width + 0.5, 0.5, g.depth + 0.5), postMat);
      plinth.position.y = 0.25;
      plinth.receiveShadow = true;

      roofMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85, side: THREE.DoubleSide });
      building.add(walls, stain, plinth,
        post(g.width / 2, g.depth / 2), post(-g.width / 2, g.depth / 2), post(g.width / 2, -g.depth / 2), post(-g.width / 2, -g.depth / 2),
        roofMesh(spec, roofMat));
      fit(Math.max(g.width, g.depth, g.height), g.height, lastSize === 0);
    },
    wear(spec, sim, year) {
      const w = wearAt(spec, sim, year);
      const tint = (el: "facade" | "roof" | "structure") => lerpColor(w[el].color, 0x4f6a3d, w[el].wear * algae);
      wallMats.forEach((m) => m.color.setHex(tint("facade")));
      roofMat.color.setHex(tint("roof"));
      postMat.color.setHex(tint("structure"));
      stainMat.opacity = Math.min(0.75, w.facade.wear * 0.9);
      stainMat.color.setHex(spec.materials.facade === "steel" ? 0x7a3f22 : algae > 0 ? 0x2d3a2c : 0x3a3a36);
    },
    climate(c, rainOn) {
      const m = mood(c);
      scene.background = new THREE.Color(m.sky);
      (scene.fog as THREE.Fog).color.setHex(m.fog);
      sun.intensity = m.sun;
      groundMat.color.setHex(rainOn ? lerpColor(m.ground, 0x000000, 0.22) : m.ground);
      algae = stresses(c).moisture >= 1 ? 0.35 : 0;
      const r = rainSettings(c);
      rain = { drops: r.drops, speed: reduced ? 0 : r.speed, slant: r.slant, on: rainOn && r.active };
      rainLines.visible = rain.on;
      rainGeo.setDrawRange(0, rain.drops * 2);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeObject(building);
      [texW, texD, streaks].forEach((t) => t.dispose());
      rainGeo.dispose(); rainMat.dispose(); groundMat.dispose(); ground.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (rain.on && rain.speed > 0) {
      for (let i = 0; i < rain.drops; i++) {
        const o = i * 6;
        let y = rainPos[o + 1] - rain.speed * dt;
        let x = rainPos[o] + rain.slant * rain.speed * dt;
        if (y < 0) { y = 30 + Math.random() * 4; x = (Math.random() - 0.5) * 90; rainPos[o + 2] = rainPos[o + 5] = (Math.random() - 0.5) * 90; }
        rainPos[o] = x; rainPos[o + 1] = y;
        rainPos[o + 3] = x - rain.slant * 1.1; rainPos[o + 4] = y + 1.1;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return rt;
}

export default function StudioScene({ spec, sim, year, rain, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!host.current) return;
    rt.current = createRuntime(host.current, setError);
    return () => { rt.current?.dispose(); rt.current = null; };
  }, []);

  useEffect(() => { rt.current?.rebuild(spec); rt.current?.wear(spec, sim, year); }, [spec.widthM, spec.depthM, spec.heightM, spec.storeys, spec.roof, spec.type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rt.current?.climate(sim.climate, rain); }, [sim.climate, rain]);
  useEffect(() => { rt.current?.wear(spec, sim, year); }, [spec, sim, year]);

  return (
    <div className="st-scene" role="img" aria-label={label}>
      <div ref={host} className="st-scene-host" />
      {error && <p className="st-scene-error">{error}</p>}
    </div>
  );
}
