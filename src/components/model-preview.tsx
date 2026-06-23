"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

type Props = {
  fileName: string;
  materialColor?: string;
  url?: string;
};

export function ModelPreview({ fileName, materialColor = "#facc15", url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Loading 3D preview...");
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const supported = ["stl", "obj", "3mf"].includes(extension);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url || !supported) return;

    const modelUrl = url;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
    camera.position.set(90, 70, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 320, container.clientHeight || 240);
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 2.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(80, 120, 90);
    scene.add(keyLight);
    const grid = new THREE.GridHelper(160, 16, 0xfacc15, 0x3f3f46);
    grid.position.y = -1;
    scene.add(grid);

    let mounted = true;
    let frame = 0;
    let loadedObject: THREE.Object3D | null = null;

    const modelMaterial = makeMaterial(materialColor);

    async function loadModel() {
      try {
        let object: THREE.Object3D;
        if (extension === "stl") {
          const geometry = await new STLLoader().loadAsync(modelUrl);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, modelMaterial);
        } else if (extension === "obj") {
          object = await new OBJLoader().loadAsync(modelUrl);
          applyMaterial(object, modelMaterial);
        } else {
          object = await new ThreeMFLoader().loadAsync(modelUrl);
          applyMaterial(object, modelMaterial);
        }

        if (!mounted) return;
        loadedObject = object;
        scene.add(object);
        frameObject(object, camera, controls);
        setMessage("");
      } catch {
        if (mounted) setMessage("Could not render this model preview. The file is uploaded and will still be reviewed.");
      }
    }

    function animate() {
      frame = requestAnimationFrame(animate);
      if (loadedObject) loadedObject.rotation.y += 0.004;
      controls.update();
      renderer.render(scene, camera);
    }

    loadModel();
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth || 320;
      const height = container.clientHeight || 240;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [extension, materialColor, supported, url]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-t-md bg-zinc-950">
      {supported ? <div className="h-full w-full" ref={containerRef} /> : null}
      {message ? (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 px-4 text-center text-sm font-semibold leading-6 text-zinc-300">
          {supported ? message : `${extension.toUpperCase() || "This file"} preview is not available in-browser yet.`}
        </div>
      ) : null}
    </div>
  );
}

function makeMaterial(color: string) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color || "#facc15"), roughness: 0.55, metalness: 0.08 });
}

function applyMaterial(object: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material;
    }
  });
}

function frameObject(object: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 90 / maxDim;

  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));

  const framedBox = new THREE.Box3().setFromObject(object);
  const framedCenter = framedBox.getCenter(new THREE.Vector3());
  const framedSize = framedBox.getSize(new THREE.Vector3());
  const distance = Math.max(framedSize.x, framedSize.y, framedSize.z) * 1.8;

  camera.position.set(framedCenter.x + distance, framedCenter.y + distance * 0.65, framedCenter.z + distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.target.copy(framedCenter);
  controls.update();
}
