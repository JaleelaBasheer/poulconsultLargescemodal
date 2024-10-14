import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF'; // To load GLTF/GLB models

function GlbLoaderWithoutOctree() {
  const canvasRef = useRef(null);  // To hold the canvas element
  const engineRef = useRef(null);  // Babylon engine reference
  const sceneRef = useRef(null);   // Babylon scene reference
  const [culledCount, setCulledCount] = useState(0);  // State to track culled meshes count
  const [unculledCount, setUnculledCount] = useState(0);  // State to track unculled meshes count

  // Initialize Babylon.js scene when the component mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    engineRef.current = engine;
    sceneRef.current = scene;

    // Create a simple environment
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 5, new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    // Resize the engine if the window is resized
    window.addEventListener('resize', () => {
      engine.resize();
    });

    // Render loop with mesh occlusion check
    engine.runRenderLoop(() => {
      if (scene.meshes.length > 0) {
        let culled = 0;
        let unculled = 0;

        // Loop through all meshes to check their occlusion status
        scene.meshes.forEach(mesh => {
          if (mesh.isOccluded) {
            culled += 1;
          } else {
            unculled += 1;
          }
        });

        // Update the culled and unculled counts
        setCulledCount(culled);
        setUnculledCount(unculled);
      }

      scene.render();
    });

    // Cleanup on unmount
    return () => {
      engine.dispose();
    };
  }, []);

  // Handle GLB file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && sceneRef.current) {
      const scene = sceneRef.current;
      const url = URL.createObjectURL(file);

      // Load the GLB model
      BABYLON.SceneLoader.Append("", url, scene, (loadedScene) => {
        console.log("GLB model loaded!");

        // Calculate the bounding box of all loaded meshes
        let boundingBox = BABYLON.BoundingBox.Empty();
        loadedScene.meshes.forEach(mesh => {
          boundingBox = BABYLON.BoundingBox.Merge(boundingBox, mesh.getBoundingInfo().boundingBox);
        });

        // Set camera position based on the bounding box
        const center = boundingBox.center;
        const size = boundingBox.extendSize;

        // Position the camera at an appropriate distance from the center of the bounding box
        const distance = Math.max(size.x, size.y, size.z) * 2; // Adjust this factor as necessary
        const cameraPosition = new BABYLON.Vector3(center.x, center.y + size.y, center.z + distance); // Above and behind the center
        const camera = scene.activeCamera; // Get the current camera

        // Update camera position and target
        camera.position = cameraPosition;
        camera.setTarget(center); // Look at the center of the bounding box

        // Apply occlusion culling to all meshes
        loadedScene.meshes.forEach(mesh => {
          mesh.occlusionQueryAlgorithmType = BABYLON.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_CONSERVATIVE; // Conservative occlusion algorithm
          mesh.occlusionRetryCount = 2; // Retry before marking as occluded
          mesh.occlusionType = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC; // Optimistic culling
          mesh.isOcclusionQueryInProgress = false;
          mesh.occlusionThreshold = 0.5; // Set occlusion threshold
          mesh.isOccluded = false; // Initial occlusion state
        });
      }, null, null, '.glb');
    }
  };

  return (
    <div>
      <input type="file" accept=".glb" onChange={handleFileUpload} />
      <canvas ref={canvasRef} style={{ width: '100%', height: '500px' }}></canvas>
      <div style={{ marginTop: '10px' }}>
        <p><strong>Culled Meshes:</strong> {culledCount}</p>
        <p><strong>Unculled Meshes:</strong> {unculledCount}</p>
      </div>
    </div>
  );
}

export default GlbLoaderWithoutOctree;
