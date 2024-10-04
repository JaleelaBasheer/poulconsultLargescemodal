import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getAllOctreeNodes, getAllGlbMeshes } from './OctreeAndGlbStore';

const SceneLoader = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();

    renderer.setSize(window.innerWidth, window.innerHeight);
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
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);


    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const loadFromIndexedDB = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingStatus('');
    try {
      setLoadingStatus('Loading Octree nodes...');
      const octreeNodes = await getAllOctreeNodes();
      console.log(`Loaded ${octreeNodes.length} Octree nodes`);

      setLoadingStatus('Loading meshes...');
      const meshes = await getAllGlbMeshes();
      console.log(`Loaded ${meshes.length} meshes`);

      if (!octreeNodes.length) {
        throw new Error('No Octree nodes found in IndexedDB');
      }

      if (!meshes.length) {
        throw new Error('No meshes found in IndexedDB');
      }

      setLoadingStatus('Clearing existing meshes...');
      // Clear existing meshes from the scene
      sceneRef.current.children = sceneRef.current.children.filter(child => !(child instanceof THREE.Mesh));

      setLoadingStatus('Recreating Octree...');
      // Recreate Octree (simplified version)
      const octree = {};
      octreeNodes.forEach(node => {
        octree[node.id] = node;
      });

      setLoadingStatus('Adding meshes to scene...');
      // Add meshes to the scene based on Octree
      let addedMeshCount = 0;
      meshes.forEach((mesh, index) => {
        if (!mesh || !mesh.position) {
          console.warn(`Invalid mesh data for mesh ${index}, skipping`);
          return;
        }

        const position = mesh.position;
        console.log(`Mesh ${index} position:`, position);

        let currentNode = octree['node_0']; // Start from root node
        let nodeDepth = 0;
        while (currentNode) {
          console.log(`Checking node at depth ${nodeDepth}:`, currentNode);
          if (isPointInNode(position, currentNode)) {
            if (!currentNode.children) {
              // We've reached a leaf node, add the mesh to the scene
              sceneRef.current.add(mesh);
              addedMeshCount++;
              console.log(`Added mesh ${index} to scene at depth ${nodeDepth}`);
              break;
            } else {
              // Check children
              const nextNode = currentNode.children.find(childId => 
                isPointInNode(position, octree[childId])
              );
              if (nextNode) {
                currentNode = octree[nextNode];
                nodeDepth++;
              } else {
                console.warn(`No child node found for mesh ${index}, adding to current node`);
                sceneRef.current.add(mesh);
                addedMeshCount++;
                break;
              }
            }
          } else {
            console.warn(`Mesh ${index} not in node, adding to scene anyway`);
            sceneRef.current.add(mesh);
            addedMeshCount++;
            break;
          }
        }
      });

      console.log(`Added ${addedMeshCount} meshes to the scene`);
      setLoadingStatus(`Loaded successfully. Added ${addedMeshCount} meshes to the scene.`);

      // Center camera on the scene
      const box = new THREE.Box3().setFromObject(sceneRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Zoom out a little so objects don't fill the screen

      cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
      const controls = controlsRef.current;
      controls.target.set(center.x, center.y, center.z);
      controls.update();

    } catch (error) {
      console.error("Error loading from IndexedDB:", error);
      setError(error.message);
      setLoadingStatus('Error occurred while loading.');
    } finally {
      setIsLoading(false);
    }
  };

  const isPointInNode = (point, node) => {
    const nodeCenter = new THREE.Vector3().fromArray(node.center);
    const halfSize = node.size / 2;
    const result = (
      point.x >= nodeCenter.x - halfSize && point.x <= nodeCenter.x + halfSize &&
      point.y >= nodeCenter.y - halfSize && point.y <= nodeCenter.y + halfSize &&
      point.z >= nodeCenter.z - halfSize && point.z <= nodeCenter.z + halfSize
    );
    console.log(`Is point ${point.toArray()} in node ${node.id}? ${result}`);
    console.log(`Node center: ${nodeCenter.toArray()}, half size: ${halfSize}`);
    return result;
  };


  return (
    <div>
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      <div style={{ position: 'absolute', bottom: '10px', left: '10px' }}>
        <button onClick={loadFromIndexedDB} disabled={isLoading}>
         <p style={{ color: 'red' }}>{isLoading ? 'Loading...' : 'Load from IndexedDB'}</p> 
        </button>
        {loadingStatus && <p style={{ color: 'white' }}>{loadingStatus}</p>}
        {error && <p style={{ color: 'white' }}>{error}</p>}
      </div>
    </div>
  );
};

export default SceneLoader;