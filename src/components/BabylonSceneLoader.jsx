// import React, { useEffect, useRef, useState } from 'react';
// import * as BABYLON from '@babylonjs/core';
// import '@babylonjs/loaders/glTF';
// import { getAllOctreeNodes, getAllGlbMeshes } from './OctreeAndGlbStore';

// const BabylonSceneLoader = () => {
//   const canvasRef = useRef(null);
//   const engineRef = useRef(null);
//   const sceneRef = useRef(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [loadingStatus, setLoadingStatus] = useState('');

//   useEffect(() => {
//     if (canvasRef.current) {
//       const engine = new BABYLON.Engine(canvasRef.current, true);
//       engineRef.current = engine;

//       const createScene = () => {
//         const scene = new BABYLON.Scene(engine);
//         sceneRef.current = scene;

//         const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
//         camera.attachControl(canvasRef.current, true);

//         const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

//         return scene;
//       };

//       const scene = createScene();

//       engine.runRenderLoop(() => {
//         scene.render();
//       });

//       const handleResize = () => {
//         engine.resize();
//       };

//       window.addEventListener('resize', handleResize);

//       return () => {
//         window.removeEventListener('resize', handleResize);
//         engine.dispose();
//       };
//     }
//   }, []);

//   const loadFromIndexedDB = async () => {
//     setIsLoading(true);
//     setError(null);
//     setLoadingStatus('');
//     try {
//       // Load Octree nodes
//       setLoadingStatus('Loading Octree nodes...');
//       const octreeNodes = await getAllOctreeNodes();
//       console.log(`Loaded ${octreeNodes.length} Octree nodes`);
//       if (!octreeNodes.length) {
//         throw new Error('No Octree nodes found in IndexedDB');
//       }
  
//       // Load meshes
//       setLoadingStatus('Loading meshes...');
//       const meshes = await getAllGlbMeshes();
//       console.log(`Loaded ${meshes.length} meshes`);
//       if (!meshes.length) {
//         throw new Error('No meshes found in IndexedDB');
//       }
  
//       // Clear existing meshes
//       setLoadingStatus('Clearing existing meshes...');
//       sceneRef.current.meshes.slice().forEach(mesh => mesh.dispose());
  
//       // Calculate bounds for all meshes
//       const bounds = calculateBounds(meshes);
//       console.log('Calculated bounds:', bounds);
  
//       // Recreate Octree with adjusted bounds
//       setLoadingStatus('Recreating Octree...');
//       const octree = createAdjustedOctree(bounds);
  
//       // Add meshes to scene
//       setLoadingStatus('Adding meshes to scene...');
//       let addedMeshCount = 0;
//       let failedMeshCount = 0;
  
//       for (const meshData of meshes) {
//         if (!meshData || !meshData.userData || !meshData.userData.position) {
//           console.warn(`Invalid mesh data, skipping`);
//           failedMeshCount++;
//           continue;
//         }
  
//         const position = new BABYLON.Vector3(
//           meshData.userData.position.x, 
//           meshData.userData.position.y, 
//           meshData.userData.position.z
//         );
//         console.log(`Processing mesh at position:`, position.toString());
  
//         // Create a simple box mesh as a placeholder
//         const mesh = BABYLON.MeshBuilder.CreateBox("mesh" + addedMeshCount, {size: 1}, sceneRef.current);
//         mesh.position = position;
  
    
//         addedMeshCount++;
//         console.log(`Added placeholder mesh to scene at position ${position.toString()}`);
//       }
  
//       console.log(`Added ${addedMeshCount} meshes to the scene`);
//       console.log(`Failed to add ${failedMeshCount} meshes`);
//       setLoadingStatus(`Loaded successfully. Added ${addedMeshCount} meshes to the scene. Failed to add ${failedMeshCount} meshes.`);
  
//       // Center camera on the scene
//       if (addedMeshCount > 0) {
//         const camera = sceneRef.current.activeCamera;
//         if (camera && camera.setTarget) {
//           const center = new BABYLON.Vector3(
//             (bounds.max.x + bounds.min.x) / 2,
//             (bounds.max.y + bounds.min.y) / 2,
//             (bounds.max.z + bounds.min.z) / 2
//           );
//           const radius = BABYLON.Vector3.Distance(bounds.max, bounds.min) / 2;
//           camera.setTarget(center);
//           camera.radius = radius * 1.5;
//           console.log(`Camera positioned at: ${camera.position.toString()}, looking at: ${center.toString()}`);
//         } else {
//           console.warn('Camera not available or does not support setTarget');
//         }
//       } else {
//         console.warn('No meshes were added to the scene');
//       }
  
//     } catch (error) {
//       console.error("Error loading from IndexedDB:", error);
//       setError(error.message);
//       setLoadingStatus('Error occurred while loading.');
//     } finally {
//       setIsLoading(false);
//     }
//   };
  
  
//   const calculateBounds = (meshes) => {
//     const bounds = {
//       min: new BABYLON.Vector3(Infinity, Infinity, Infinity),
//       max: new BABYLON.Vector3(-Infinity, -Infinity, -Infinity)
//     };
  
//     meshes.forEach(mesh => {
//       if (mesh.userData && mesh.userData.position) {
//         const pos = mesh.userData.position;
//         bounds.min.x = Math.min(bounds.min.x, pos.x);
//         bounds.min.y = Math.min(bounds.min.y, pos.y);
//         bounds.min.z = Math.min(bounds.min.z, pos.z);
//         bounds.max.x = Math.max(bounds.max.x, pos.x);
//         bounds.max.y = Math.max(bounds.max.y, pos.y);
//         bounds.max.z = Math.max(bounds.max.z, pos.z);
//       }
//     });
  
//     return bounds;
//   };
  
//   const createAdjustedOctree = (bounds) => {
//     const center = new BABYLON.Vector3(
//       (bounds.max.x + bounds.min.x) / 2,
//       (bounds.max.y + bounds.min.y) / 2,
//       (bounds.max.z + bounds.min.z) / 2
//     );
//     const size = Math.max(
//       bounds.max.x - bounds.min.x,
//       bounds.max.y - bounds.min.y,
//       bounds.max.z - bounds.min.z
//     ) * 1.1; // Add 10% padding
  
//     return new BABYLON.Octree(center, size);
//   };
  
//   const isPointInNode = (point, node) => {
//     const nodeCenter = new BABYLON.Vector3(node.center[0], node.center[1], node.center[2]);
//     const halfSize = node.size / 2;
//     const result = (
//       point.x >= nodeCenter.x - halfSize && point.x <= nodeCenter.x + halfSize &&
//       point.y >= nodeCenter.y - halfSize && point.y <= nodeCenter.y + halfSize &&
//       point.z >= nodeCenter.z - halfSize && point.z <= nodeCenter.z + halfSize
//     );
//     console.log(`Is point ${point.toString()} in node ${node.id}? ${result}`);
//     console.log(`Node center: ${nodeCenter.toString()}, half size: ${halfSize}`);
//     return result;
//   };
//   return (
//     <div>
//       <canvas ref={canvasRef} style={{ width: '100%', height: '100vh' }} />
//       <div style={{ position: 'absolute', bottom: '10px', left: '10px' }}>
//         <button onClick={loadFromIndexedDB} disabled={isLoading}>
//          <p style={{ color: 'red' }}>{isLoading ? 'Loading...' : 'Load from IndexedDB'}</p> 
//         </button>
//         {loadingStatus && <p style={{ color: 'white' }}>{loadingStatus}</p>}
//         {error && <p style={{ color: 'white' }}>{error}</p>}
//       </div>
//     </div>
//   );
// };

// export default BabylonSceneLoader;

