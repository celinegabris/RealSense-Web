 import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import socket from '../utils/socket';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function decodeBase64Vertices(base64) {
  const binary = atob(base64);
  const len = binary.length / 4;
  const floatArray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const bytes = [
      binary.charCodeAt(i * 4),
      binary.charCodeAt(i * 4 + 1),
      binary.charCodeAt(i * 4 + 2),
      binary.charCodeAt(i * 4 + 3),
    ];
    const view = new DataView(new ArrayBuffer(4));
    bytes.forEach((b, j) => view.setUint8(j, b));
    floatArray[i] = view.getFloat32(0, true);
  }
  return floatArray;
}

function PointCloudViewer({ deviceId }) {
  const mountRef = useRef();
  const pointsRef = useRef();
  const sceneRef = useRef();

  useEffect(() => {
    console.log("🎯 PointCloudViewer mounted");

    if (!socket.connected) {
      console.warn("⚠️ Socket not yet connected!");
    }

    socket.on("connect", () => {
      console.log("🔌 Socket connected from PointCloudViewer");
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 10);
    camera.position.z = 1.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const handleMetadata = (data) => {
      
      if (!data.metadata_streams?.depth?.point_cloud?.vertices) return;

      const base64 = data.metadata_streams.depth.point_cloud.vertices;
      const vertices = decodeBase64Vertices(base64);
      console.log("📡 Decoded point cloud vertices", vertices);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(vertices, 3)
      );

      const material = new THREE.PointsMaterial({ color: 0x00ff00, size: 0.005 });
      const points = new THREE.Points(geometry, material);

      if (pointsRef.current) {
        sceneRef.current.remove(pointsRef.current);
      }

      sceneRef.current.add(points);
      pointsRef.current = points;
    };

    socket.on('metadata_update', handleMetadata);
    return () => socket.off('metadata_update', handleMetadata);
  }, []);



  return <div className="pointcloud-container" ref={mountRef}></div>;
}

export default PointCloudViewer;