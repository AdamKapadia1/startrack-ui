import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LocationSettings } from '../hooks/useLocation';
import { getConstellation, CONSTELLATION_COLORS } from '../utils/constellation';

const API_BASE   = import.meta.env.VITE_API_URL ?? '';
const EARTH_R    = 5;      // scene units
const EARTH_KM   = 6371;   // km

interface SatPos {
  satname:           string;
  lat:               number;
  lon:               number;
  altKm:             number;
  constellation:     string | null;
  footprintRadiusKm: number;
}

// Pre-compute Three.js colors from shared CSS palette
const CONST_COLORS: Record<string, THREE.Color> = Object.fromEntries(
  Object.entries(CONSTELLATION_COLORS).map(([k, v]) => [k, new THREE.Color(v)])
);
const COLOR_DEFAULT = new THREE.Color(0x4a6080);

function satColor(satname: string, constellation: string | null): THREE.Color {
  const c = getConstellation(satname, constellation);
  return CONST_COLORS[c] ?? COLOR_DEFAULT;
}

function latLonAltToVec3(lat: number, lon: number, altKm: number): THREE.Vector3 {
  const r     = EARTH_R + (altKm / EARTH_KM) * EARTH_R;
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

interface Props {
  location:  LocationSettings;
  isMobile?: boolean;
}

export function Globe3D({ location, isMobile }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const [showFootprint,   setShowFootprint]   = useState(false);
  const showFootprintRef  = useRef(false);
  showFootprintRef.current = showFootprint;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── Scene ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);

    // ── Camera ─────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      45,
      el.clientWidth / el.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 18);

    // ── Renderer ───────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // ── Orbit controls ─────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.06;
    controls.minDistance     = 7;
    controls.maxDistance     = 60;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.3;
    // Pause auto-rotation while dragging
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    controls.addEventListener('end',   () => { controls.autoRotate = true;  });

    // ── Lights ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223344, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(12, 6, 8);
    scene.add(sun);

    // ── Earth: solid inner sphere ───────────────────────────
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 56, 56),
      new THREE.MeshPhongMaterial({ color: 0x0d1f2e, shininess: 30 }),
    );
    scene.add(earthMesh);

    // ── Earth: wireframe overlay ────────────────────────────
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.004, 28, 28),
      new THREE.MeshPhongMaterial({
        color:       0x1a3a5a,
        wireframe:   true,
        transparent: true,
        opacity:     0.28,
      }),
    ));

    // ── Starfield ───────────────────────────────────────────
    const starPos = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 150 + Math.random() * 50;
      starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true }),
    ));

    // ── Observer marker ─────────────────────────────────────
    const obsVec  = latLonAltToVec3(location.lat, location.lon, 0);
    const obsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.6 }),
    );
    obsMesh.position.copy(obsVec);
    scene.add(obsMesh);

    // Observer glow ring
    const ringGeo = new THREE.TorusGeometry(0.25, 0.03, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.5 });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(obsVec);
    ring.lookAt(0, 0, 0);
    scene.add(ring);

    // ── Satellite points + footprints ───────────────────────
    let satPoints:    THREE.Points        | null = null;
    let footprintMesh: THREE.InstancedMesh | null = null;

    const fpGeo = new THREE.CircleGeometry(1, 16);
    const fpMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    });

    function updateSatellites(sats: SatPos[]) {
      // ── satellite dots ──────────────────────────────────
      if (satPoints) {
        scene.remove(satPoints);
        satPoints.geometry.dispose();
        (satPoints.material as THREE.Material).dispose();
        satPoints = null;
      }
      if (footprintMesh) {
        scene.remove(footprintMesh);
        footprintMesh.dispose();
        footprintMesh = null;
      }
      if (!sats.length) return;

      const posArr  = new Float32Array(sats.length * 3);
      const colArr  = new Float32Array(sats.length * 3);

      sats.forEach((sat, i) => {
        const v   = latLonAltToVec3(sat.lat, sat.lon, sat.altKm);
        const col = satColor(sat.satname, sat.constellation);
        posArr[i * 3]     = v.x; posArr[i * 3 + 1] = v.y; posArr[i * 3 + 2] = v.z;
        colArr[i * 3]     = col.r; colArr[i * 3 + 1] = col.g; colArr[i * 3 + 2] = col.b;
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));
      satPoints = new THREE.Points(geo, new THREE.PointsMaterial({
        vertexColors: true, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.92,
      }));
      scene.add(satPoints);

      // ── footprint circles (InstancedMesh) ───────────────
      const up = new THREE.Vector3(0, 1, 0);
      footprintMesh = new THREE.InstancedMesh(fpGeo, fpMat, sats.length);
      footprintMesh.visible = showFootprintRef.current;

      const mat4 = new THREE.Matrix4();
      const q    = new THREE.Quaternion();
      sats.forEach((sat, i) => {
        const groundPos = latLonAltToVec3(sat.lat, sat.lon, 0);
        const normal    = groundPos.clone().normalize();
        const pos       = normal.clone().multiplyScalar(EARTH_R + 0.015);
        const scaleU    = sat.footprintRadiusKm * (EARTH_R / EARTH_KM);
        q.setFromUnitVectors(up, normal);
        mat4.compose(pos, q, new THREE.Vector3(scaleU, scaleU, 1));
        footprintMesh!.setMatrixAt(i, mat4);
      });
      footprintMesh.instanceMatrix.needsUpdate = true;
      scene.add(footprintMesh);
    }

    // ── Fetch satellite positions ───────────────────────────
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function fetchPositions() {
      try {
        const r = await fetch(`${API_BASE}/api/satellites/positions3d`);
        if (r.ok) updateSatellites(await r.json());
      } catch { /* keep stale */ }
    }

    fetchPositions();
    pollId = setInterval(fetchPositions, 5000);

    // ── Resize handler ──────────────────────────────────────
    function onResize() {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    // ── Render loop ─────────────────────────────────────────
    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      if (footprintMesh) footprintMesh.visible = showFootprintRef.current;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ── Cleanup ─────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      if (pollId) clearInterval(pollId);
      ro.disconnect();
      controls.dispose();
      fpGeo.dispose();
      fpMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [location.lat, location.lon]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="globe3d-outer">
      <div ref={containerRef} className="globe3d-container">
        {isMobile && (
          <div className="globe3d-mobile-note">3D view works best on desktop — touch to orbit</div>
        )}
      </div>
      <div className="globe3d-controls">
        <label className="groundtrack-legend-item groundtrack-footprint-toggle">
          <input
            type="checkbox"
            checked={showFootprint}
            onChange={e => setShowFootprint(e.target.checked)}
          />
          Show coverage footprints
        </label>
      </div>
    </div>
  );
}
