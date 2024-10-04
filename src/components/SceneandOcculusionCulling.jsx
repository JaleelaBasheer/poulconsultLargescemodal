import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getAllOctreeNodes, getAllGlbMeshes,getGlbMeshByUserDataId } from './OctreeAndGlbStore';

const SceneandOcculusionCulling = () => {
    const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const octreeRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [showOctree, setShowOctree] = useState(true);
  const [hitNodes, setHitNodes] = useState(0);
  const [unhitNodes, setUnhitNodes] = useState(0);
  const [visibleMeshCount, setVisibleMeshCount] = useState(0);
  const [totalMeshesInScene, setTotalMeshesInScene] = useState(0);
  const [meshesToLoad, setMeshesToLoad] = useState(0);
  const [meshesToRemove, setMeshesToRemove] = useState(0);
  const octreeVisualizationRef = useRef(null);
  const meshesMapRef = useRef(new Map());
  const loadedMeshesRef = useRef(new Set());
  const [isOctreeLoaded, setIsOctreeLoaded] = useState(false);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0Xffff00)
    mountRef.current.appendChild(renderer.domElement);
    camera.position.z = 5;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    const animate = () => {
      requestAnimationFrame(animate);
    //   if (isOctreeLoaded) {
        // performOcclusionCulling();
    //   }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // loadFromIndexedDB();


    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);
  const [allMeshes, setAllMeshes] = useState(new Map());
  useEffect(()=>{
    loadAllData();

  },[])

  const loadAllData = async () => {
    try {
      setLoadingStatus('Loading Octree nodes...');
      const octreeNodes = await getAllOctreeNodes();
      octreeRef.current = octreeNodes;

      setLoadingStatus('Loading mesh data...');
      const meshes = await getAllGlbMeshes();

      if (!octreeNodes.length) throw new Error('No Octree nodes found in IndexedDB');
      if (!meshes.length) throw new Error('No meshes found in IndexedDB');

      // Store all meshes in the state
      const meshMap = new Map();
      meshes.forEach(mesh => {
        meshMap.set(mesh.userData.id, mesh);
      });
      setAllMeshes(meshMap);
      setLoadingStatus('Creating Octree visualization...');
      const octreeVisualization = createOctreeVisualization(octreeNodes);
      sceneRef.current.add(octreeVisualization);
      octreeVisualizationRef.current = octreeVisualization;
      octreeVisualizationRef.current.visible = showOctree;

  // Camera adjustments
  const box = new THREE.Box3().setFromObject(octreeVisualization);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = cameraRef.current.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.5;

  cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
  controlsRef.current.target.set(center.x, center.y, center.z);
  controlsRef.current.update();
      setIsOctreeLoaded(true);
      setLoadingStatus('Data loaded. Ready for occlusion culling.');
      performOcclusionCulling()

    } catch (error) {
      console.error('Error in loadAllData:', error);
      setError(error.message);
      setLoadingStatus('Error occurred while loading.');
    } finally {
      setIsLoading(false);
    }
  };



  const createOctreeVisualization = (octreeNodes) => {
    const octreeGroup = new THREE.Group();
    octreeGroup.name = 'OctreeVisualization';

    const material = new THREE.LineBasicMaterial({ color: 0x00fff0 });

    octreeNodes.forEach((node) => {
      const geometry = new THREE.BoxGeometry(node.size, node.size, node.size);
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(edges, material);
      line.position.set(node.center.x, node.center.y, node.center.z);
      line.userData = {
        ...node,
        nodeId: node.id,
      };
      octreeGroup.add(line);
    });

    return octreeGroup;
  };

  const loadFromIndexedDB = async () => {
    try {
      setLoadingStatus('Loading Octree nodes...');
      const octreeNodes = await getAllOctreeNodes();
      octreeRef.current = octreeNodes;

    //   setLoadingStatus('Loading mesh data...');
    //   const meshes = await getAllGlbMeshes();

      if (!octreeNodes.length) throw new Error('No Octree nodes found in IndexedDB');
    //   if (!meshes.length) throw new Error('No meshes found in IndexedDB');

      setLoadingStatus('Creating Octree visualization...');
      const octreeVisualization = createOctreeVisualization(octreeNodes);
      sceneRef.current.add(octreeVisualization);
      octreeVisualizationRef.current = octreeVisualization;
      octreeVisualizationRef.current.visible = showOctree;

    //   setLoadingStatus('Preparing mesh data...');
    //   meshes.forEach((mesh) => {
    //     meshesMapRef.current.set(mesh.uuid, mesh);
    //   });

      // Camera adjustments
      const box = new THREE.Box3().setFromObject(octreeVisualization);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
      controlsRef.current.target.set(center.x, center.y, center.z);
      controlsRef.current.update();

      setIsOctreeLoaded(true);
      setLoadingStatus('Octree loaded. Performing initial culling...');
      performOcclusionCulling()
    } catch (error) {
      console.error('Error in loadFromIndexedDB:', error);
      setError(error.message);
      setLoadingStatus('Error occurred while loading.');
    } finally {
      setIsLoading(false);
    }
  };


const [meshesInUnhitNodes, setMeshesInUnhitNodes] = useState(0);
const [newMeshes, setNewMeshes] = useState(0);

const [meshesToUnload, setMeshesToUnload] = useState(0);

// const performOcclusionCulling = async () => {
//     if (!octreeRef.current || !meshesMapRef.current) {
//       console.warn('Octree or meshes not loaded yet. Skipping occlusion culling.');
//       return;
//     }

//     // Clear loadedMeshesRef at the start of each culling operation
//     loadedMeshesRef.current.clear();

//     let hitCount = 0;
//     let unhitCount = 0;
//     let visibleMeshCount = 0;
//     let meshesInUnhitNodesCount = 0;
//     let newMeshesCount = 0;
//     let meshesToUnloadCount = 0;
//     const hitMeshIds = new Set();
//     const unhitMeshIds = new Set();

//     const camera = cameraRef.current;
//     const raycaster = raycasterRef.current;

//     const rayDirections = [
//       new THREE.Vector3(0, 0, -1),  // Forward
//       new THREE.Vector3(1, 0, -1).normalize(),  // Forward-Right
//       new THREE.Vector3(-1, 0, -1).normalize(), // Forward-Left
//       new THREE.Vector3(0, 1, -1).normalize(),  // Forward-Up
//       new THREE.Vector3(0, -1, -1).normalize()  // Forward-Down
//     ];
//     // First pass: Identify hit and unhit nodes
//     for (const node of octreeRef.current) {
//       try {
//         if (!node.center || typeof node.size !== 'number') {
//           console.warn('Invalid node structure:', node);
//           continue;
//         }

//         const halfSize = node.size / 2;
//         const nodeBoundingBox = new THREE.Box3(
//           new THREE.Vector3(
//             node.center.x - halfSize,
//             node.center.y - halfSize,
//             node.center.z - halfSize
//           ),
//           new THREE.Vector3(
//             node.center.x + halfSize,
//             node.center.y + halfSize,
//             node.center.z + halfSize
//           )
//         );

//         let isNodeHit = false;

//         for (const direction of rayDirections) {
//           raycaster.set(camera.position, direction);
//           if (raycaster.ray.intersectsBox(nodeBoundingBox)) {
//             isNodeHit = true;
//             break;
//           }
//         }

//         if (isNodeHit) {
//           hitCount++;
//           if (Array.isArray(node.objects)) {
//             node.objects.forEach(object => hitMeshIds.add(object.userData.id));
//           }
//         //   if (Array.isArray(node.objects)) {
//         //     node.objects.forEach(mesh => {
//         //       hitMeshIds.add(mesh.userData.id)

//         //         // Compute the mesh's bounding box
//         //         const meshBoundingBox = new THREE.Box3().setFromObject(mesh);

//         //         // Check if the ray intersects the mesh's bounding box
//         //         if (raycaster.ray.intersectsBox(meshBoundingBox)) {
//         //           hitMeshIds.add(mesh.userData.id)
//         //             console.log('Mesh hit:', mesh.userData.id);
//         //         }
//         //     });
//         // }

//         } else {
//           unhitCount++;
//           if (Array.isArray(node.objects)) {
//             node.objects.forEach(object => unhitMeshIds.add(object.userData.id));
//           }
//         }
//       } catch (error) {
//         console.error('Error processing node in performOcclusionCulling:', error, node);
//       }
//     }

//     // Second pass: Unload meshes from unhit nodes
//     for (const meshId of unhitMeshIds) {
//         console.log("unload",meshId)
//       const meshToRemove = sceneRef.current.getObjectByProperty('uuid', meshId);
//       const mesh = allMeshes.get(meshId);
//       if (mesh) {
//         sceneRef.current.remove(mesh);
//         meshesToUnloadCount++;
//       }
//     }

    
//     // Third pass: Load and make visible meshes in hit nodes
//     for (const meshId of hitMeshIds) {
//         if (!loadedMeshesRef.current.has(meshId)) {
//           newMeshesCount++;
//           const mesh = allMeshes.get(meshId);
//           if (mesh) {
//             console.log('Loading mesh:', meshId);
//             sceneRef.current.add(mesh);
//             loadedMeshesRef.current.add(meshId);
//             visibleMeshCount++;
//           } else {
//             console.error('Mesh not found:', meshId);
//           }
//         } else {
//           visibleMeshCount++;
//         }
  

//       const existingMesh = sceneRef.current.getObjectByProperty('uuid', meshId);
//       if (existingMesh) {
//         existingMesh.visible = true;
//       }
//     }

//     meshesInUnhitNodesCount = unhitMeshIds.size;

//     setHitNodes(hitCount);
//     setUnhitNodes(unhitCount);
//     setVisibleMeshCount(visibleMeshCount);
//     setMeshesInUnhitNodes(meshesInUnhitNodesCount);
//     setTotalMeshesInScene(loadedMeshesRef.current.size);
//     setNewMeshes(newMeshesCount);
//     setMeshesToLoad(newMeshesCount);
//     setMeshesToUnload(meshesToUnloadCount);
//   };


// const handleCameraMove=()=>{
//   performOcclusionCulling();
// }

const performOcclusionCulling = async () => {
  if (!octreeRef.current || !meshesMapRef.current) {
    console.warn('Octree or meshes not loaded yet. Skipping occlusion culling.');
    return;
  }

  // Clear loadedMeshesRef at the start of each culling operation
  loadedMeshesRef.current.clear();

  let hitCount = 0;
  let unhitCount = 0;
  let visibleMeshCount = 0;
  let meshesInUnhitNodesCount = 0;
  let newMeshesCount = 0;
  let meshesToUnloadCount = 0;
  const hitMeshIds = new Set();
  const unhitMeshIds = new Set();

  const camera = cameraRef.current;
  const raycaster = raycasterRef.current;

  const generateDenseRayDirections = () => {
    const directions = [];
    const angleStep = Math.PI / 60; // 3 degrees
    const phiRange = Math.PI * 0.8; // 144 degrees vertical range
    const thetaRange = Math.PI * 0.8; // 144 degrees horizontal range

    for (let phi = -phiRange / 2; phi <= phiRange / 2; phi += angleStep) {
      for (let theta = -thetaRange / 2; theta <= thetaRange / 2; theta += angleStep) {
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = -Math.cos(phi);
        directions.push(new THREE.Vector3(x, y, z).normalize());
      }
    }

    return directions;
  };

  const rayDirections = generateDenseRayDirections();
  const farDistance = 1000; // Adjust this value based on your scene scale


  // First pass: Identify hit and unhit meshes
  for (const node of octreeRef.current) {
    try {
      if (!node.center || typeof node.size !== 'number') {
        console.warn('Invalid node structure:', node);
        continue;
      }

      if (Array.isArray(node.objects)) {
        for (const object of node.objects) {
          const meshId = object.userData.id;
          console.log(meshId)
          const size =object.userData.mesh.object.userData.size
          console.log( object.userData.mesh.object.userData.size)
            const halfSize =  size / 2;
        const meshBoundingBox = new THREE.Box3(
          new THREE.Vector3(
            object.position.x - halfSize,
            object.position.y - halfSize,
            object.position.z - halfSize
          ),
          new THREE.Vector3(
            object.position.x + halfSize,
            object.position.y + halfSize,
            object.position.z + halfSize
          )
        );
        console.log(meshBoundingBox)

          let isMeshHit = false;

          for (const direction of rayDirections) {
            raycaster.set(camera.position, direction);
            raycaster.far = farDistance;

            if (raycaster.ray.intersectsBox(meshBoundingBox)) {
              isMeshHit = true;
              break;
            }
          }

          if (isMeshHit) {
            hitMeshIds.add(meshId);
            hitCount++;
          } else {
            unhitMeshIds.add(meshId);
            unhitCount++;
          }
        }
      }
    } catch (error) {
      console.error('Error processing node in performOcclusionCulling:', error, node);
    }
  }

  // Second pass: Unload meshes that are no longer visible
  for (const meshId of unhitMeshIds) {
    console.log("unload",meshId)
      const meshToRemove = sceneRef.current.getObjectByProperty('uuid', meshId);
      const mesh = allMeshes.get(meshId);
      if (mesh) {
        console.log("meshes removed",mesh)
        sceneRef.current.remove(mesh);
        loadedMeshesRef.current.delete(meshId);
        meshesToUnloadCount++;
    }
  }

  // Third pass: Load and make visible meshes that are now visible
  for (const meshId of hitMeshIds) {
    if (!loadedMeshesRef.current.has(meshId)) {
      const mesh = allMeshes.get(meshId);
      if (mesh) {
        console.log('Loading mesh:', meshId);
        sceneRef.current.add(mesh);
        loadedMeshesRef.current.add(meshId);
        newMeshesCount++;
      } else {
        console.error('Mesh not found:', meshId);
      }
    }
    visibleMeshCount++;
  }

  meshesInUnhitNodesCount = unhitMeshIds.size;

  setHitNodes(hitCount);
  setUnhitNodes(unhitCount);
  setVisibleMeshCount(visibleMeshCount);
  setMeshesInUnhitNodes(meshesInUnhitNodesCount);
  setTotalMeshesInScene(loadedMeshesRef.current.size);
  setNewMeshes(newMeshesCount);
  setMeshesToLoad(newMeshesCount);
  setMeshesToUnload(meshesToUnloadCount);
};
const debounce = (func, delay) => {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
};

const handleCameraMove = debounce(() => {
  performOcclusionCulling();
}, 200);  



  return (
    <div>
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      {isLoading && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
          {loadingStatus}
        </div>
      )}
      {/* {error && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,0,0,0.5)', padding: '10px', color: 'white' }}>
          Error: {error}
        </div>
      )} */}
      <button onClick={handleCameraMove}>perform raycasting</button>
      <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
      <p>Hit Nodes: {hitNodes}</p>
        <p>Unhit Nodes: {unhitNodes}</p>
        <p>Visible Meshes: {visibleMeshCount}</p>
        <p>Meshes in Unhit Nodes: {meshesInUnhitNodes}</p>
        <p>Total Meshes in Scene: {totalMeshesInScene}</p>
        <p>New Meshes to Load: {meshesToLoad}</p>
        <p>Meshes to Unload: {meshesToUnload}</p>
      </div>

    </div>
  );
};

export default SceneandOcculusionCulling;
