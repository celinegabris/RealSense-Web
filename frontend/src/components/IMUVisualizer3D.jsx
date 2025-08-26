import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export default function IMUVisualizer3D({ label = '', vector }) {
  const wrapRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);

  const bodyRef = useRef(null);
  const axesRef = useRef(null);
  const normRef = useRef(null);

  const rafRef = useRef(null);
  const [xyz, setXYZ] = useState({ x: 0, y: 0, z: 0, n: 0 });

  const units =
    String(label).toLowerCase().includes('gyro') ? 'Radians/Sec' : 'Meter/Sec²';

  function toXYZ(v) {
    if (!v) return null;
    if (Array.isArray(v) && v.length >= 3) {
      const x = +v[0], y = +v[1], z = +v[2];
      return [x, y, z].every(Number.isFinite) ? [x, y, z] : null;
    }
    const src = (v && typeof v === 'object')
      ? (v.motion_data && typeof v.motion_data === 'object' ? v.motion_data : v)
      : null;
    if (!src) return null;
    const sets = [['x','y','z'], ['ax','ay','az'], ['gx','gy','gz'], ['X','Y','Z']];
    for (const [kx, ky, kz] of sets) {
      if (kx in src && ky in src && kz in src) {
        const x = +src[kx], y = +src[ky], z = +src[kz];
        if ([x,y,z].every(Number.isFinite)) return [x, y, z];
      }
    }
    return null;
  }

  function makeRing(radius = 1, segments = 160, normal = new THREE.Vector3(0, 1, 0)) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const base = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(base, normal.clone().normalize());
    geo.applyQuaternion(q);
    const mat = new THREE.LineBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.8 });
    return new THREE.Line(geo, mat);
  }

  let camera = null;
  function makeOrthoCamera() {
    const rootW = wrapRef.current?.clientWidth || 300;
    const rootH = wrapRef.current?.clientHeight || 300;
    const aspect = rootW / rootH;
    const span = 3.4;
    const halfH = span * 0.5;
    const halfW = halfH * aspect;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
    cam.position.set(0, 2.8, 3.6);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    return cam;
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    wrapRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    camera = makeOrthoCamera();
    cameraRef.current = camera;
    scene.add(camera);

    scene.add(new THREE.AmbientLight(0x404040));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(4, 6, 8);
    scene.add(dir);

    const thetaDeg = 60;
    const theta = THREE.MathUtils.degToRad(thetaDeg);
    const R = 1.0;

    const ringEquator = makeRing(R, 160, new THREE.Vector3(0, 1, 0));
    const n0 = new THREE.Vector3(1, 0, 0);
    const yawPlus  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), +theta);
    const yawMinus = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -theta);
    const n1 = n0.clone().applyQuaternion(yawPlus);
    const n2 = n0.clone().applyQuaternion(yawMinus);
    const ringMeridian1 = makeRing(R, 160, n1);
    const ringMeridian2 = makeRing(R, 160, n2);

    const root = new THREE.Group();
    root.rotation.set(THREE.MathUtils.degToRad(-14), 0, 0);
    scene.add(root);

    root.add(ringEquator, ringMeridian1, ringMeridian2);

    const body = new THREE.Group();
    bodyRef.current = body;
    root.add(body);

    const axes = new THREE.Group();
    axesRef.current = axes;
    axes.position.set(0, 0, 0);
    axes.rotation.set(0, 0, 0);
    root.add(axes);

    const len = 0.95, headLen = 0.15, headW = 0.07;
    const xArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), len, 0xff4040, headLen, headW);
    const yArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), len, 0x40ff40, headLen, headW);
    const zArrow = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), len, 0x4080ff, headLen, headW);
    axes.add(xArrow, yArrow, zArrow);

    const normArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      0.5,
      0xffffff,
      headLen,
      headW
    );
    normRef.current = normArrow;
    root.add(normArrow);

    const ro = new ResizeObserver(() => {
      const w = wrapRef.current?.clientWidth || 300;
      const h = wrapRef.current?.clientHeight || 300;
      renderer.setSize(w, h, false);
      const newCam = makeOrthoCamera();
      scene.remove(camera);
      camera = newCam;
      cameraRef.current = camera;
      scene.add(camera);
    });
    ro.observe(wrapRef.current);

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { ro.disconnect(); } catch {}
      if (rendererRef.current) {
        const dom = rendererRef.current.domElement;
        try { rendererRef.current.dispose(); } catch {}
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
      }
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      bodyRef.current = null;
      axesRef.current = null;
      normRef.current = null;
    };
  }, []);

  useEffect(() => {
    const raw = toXYZ(vector);
    if (!raw) return;

    const isGyro  = /gyro/i.test(label);
    const isAccel = /accel|acc/i.test(label);

    const [rx, ry, rz] = raw.map(Number);
    const rn = Math.hypot(rx, ry, rz);
    setXYZ({ x: rx, y: ry, z: rz, n: rn });

    let x = rx, y = ry, z = rz;
    const assumeDegPerSecFromSource = false;
    if (isGyro && assumeDegPerSecFromSource) {
      const k = Math.PI / 180;
      x *= k; y *= k; z *= k;
    }

    if (normRef.current) {
      const dir = new THREE.Vector3(x, y, z);
      if (dir.lengthSq() < 1e-12) {
        normRef.current.setDirection(new THREE.Vector3(0,1,0));
        normRef.current.setLength(0.06, 0.15, 0.07);
      } else {
        dir.normalize();
        normRef.current.setDirection(dir);
        const L = isAccel ? Math.min(1, Math.hypot(x,y,z) / 9.80665) : Math.min(0.35, Math.hypot(x,y,z) * 0.5);
        normRef.current.setLength(L, 0.15, 0.07);
      }
    }

    if (bodyRef.current) {
      const axis = new THREE.Vector3(x, y, z);
      if (axis.lengthSq() >= 1e-9) {
        axis.normalize();
        const vizScale = isGyro ? 0.015 : 0.08;
        const angle = Math.hypot(x, y, z) * vizScale;
        const targetQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        bodyRef.current.quaternion.slerp(targetQ, 0.25);
      }
    }
  }, [vector, label]);


  const readout = useMemo(() => {
    const fmt = (v) => (Number.isFinite(v) ? v.toFixed(6) : '—');
    return (
      <div style={{
        position: 'absolute', top: 8, left: 10, fontFamily: 'Consolas, Menlo, monospace',
        fontWeight: 700, lineHeight: 1.15, letterSpacing: 0.2, userSelect: 'none'
      }}>
        <div style={{ color: '#5aa8ff', textShadow: '0 0 6px rgba(0,0,0,0.65)' }}>
          x: {fmt(xyz.x)}
        </div>
        <div style={{ color: '#66ff66', textShadow: '0 0 6px rgba(0,0,0,0.65)' }}>
          y: {fmt(xyz.y)}
        </div>
        <div style={{ color: '#ff5a5a', textShadow: '0 0 6px rgba(0,0,0,0.65)' }}>
          z: {fmt(xyz.z)}
        </div>
        <div style={{ color: '#ffffff', textShadow: '0 0 6px rgba(0,0,0,0.65)' }}>
          n: {fmt(xyz.n)}
        </div>
        <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>{units}</div>
      </div>
    );
  }, [xyz, units]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 260, textAlign: 'left' }}>
      <div ref={wrapRef} style={{ width: '100%', height: '100%' }} />
      {readout}
    </div>
  );
}
