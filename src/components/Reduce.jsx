import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';

function Reduce() {
  const [models, setModels] = useState([]);
  const [polygonCounts, setPolygonCounts] = useState([]);
  const sceneRef = useRef(null);
  const inputRef = useRef(null);
  const scene = useRef(null);
  const camera = useRef(null);
  const renderer = useRef(null);

  useEffect(() => {
    initScene();
  }, []);

  // Initialize Three.js scene
  const initScene = () => {
    scene.current = new THREE.Scene();
    camera.current = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer.current = new THREE.WebGLRenderer();
    renderer.current.setSize(window.innerWidth, window.innerHeight);
    sceneRef.current.appendChild(renderer.current.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1).normalize();
    scene.current.add(light);

    animate();
  };

  // Animation loop to render the scene
  const animate = () => {
    requestAnimationFrame(animate);
    renderer.current.render(scene.current, camera.current);
  };

  // Load FBX files from input
  const handleFileInput = async (event) => {
    const files = event.target.files;
    const loader = new FBXLoader();
    const newModels = [];
    const newPolygonCounts = [];

    let cumulativeBox = new THREE.Box3(); // Initialize cumulative bounding box

    for (let file of files) {
      const url = URL.createObjectURL(file);

      // Load the FBX model
      loader.load(url, (fbx) => {
        let originalCount = 0;
        let simplifiedCount = 0;

        // Traverse the scene and find meshes to simplify
        fbx.traverse((child) => {
          if (child.isMesh) {
            const originalGeometry = child.geometry;
            originalCount += originalGeometry.attributes.position.count;

            // Simplify the geometry
            const simplifyModifier = new SimplifyModifier();
            const simplifiedGeometry = simplifyModifier.modify(originalGeometry, Math.floor(originalGeometry.attributes.position.count * 0.5)); // 50% reduction
            simplifiedCount += simplifiedGeometry.attributes.position.count;

            // Apply the simplified geometry back to the mesh
            child.geometry = simplifiedGeometry;
          }
        });

        // Store the model and counts
        newModels.push(fbx);
        newPolygonCounts.push({
          original: originalCount,
          reduced: simplifiedCount,
        });

        // Compute and update cumulative bounding box
        const box = new THREE.Box3().setFromObject(fbx);
        cumulativeBox.union(box);

        // Add the model to the scene
        scene.current.add(fbx);

        // Set the camera to fit the cumulative bounding box
        setCameraToFitBox(cumulativeBox);
      });
    }

    setModels([...models, ...newModels]);
    setPolygonCounts([...polygonCounts, ...newPolygonCounts]);
  };

  // Set camera position to fit the cumulative bounding box
  const setCameraToFitBox = (box) => {
    const center = new THREE.Vector3();
    box.getCenter(center); // Get center of the cumulative box
    const size = new THREE.Vector3();
    box.getSize(size); // Get the size of the cumulative box

    // Set the camera position to fit the box (adjust distance based on size)
    const maxDimension = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxDimension / (2 * Math.atan((camera.current.fov * Math.PI) / 360));
    const fitWidthDistance = fitHeightDistance / camera.current.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance);

    camera.current.position.copy(center.clone().add(new THREE.Vector3(0, 0, distance)));
    camera.current.lookAt(center); // Make sure camera is looking at the center of the box

    camera.current.updateProjectionMatrix();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".fbx"
        onChange={handleFileInput}
        style={{ marginBottom: '10px' }}
      />
      <div ref={sceneRef} style={{ width: '100%', height: '100vh' }}></div>
      
      <div>
        {polygonCounts.map((count, index) => (
          <div key={index}>
            <p>Model {index + 1}</p>
            <p>Original Polygon Count: {count.original}</p>
            <p>Reduced Polygon Count: {count.reduced}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Reduce;
