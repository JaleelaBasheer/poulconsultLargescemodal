import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getAllOctreeNodes, getAllGlbMeshes,getGlbMeshByUserDataId } from './OctreeAndGlbStore';

const LoadDirectScene = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const octreeRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [showOctree, setShowOctree] = useState(true);
  const [visibleNodes, setVisibleNodes] = useState(0);
  const [unvisibleNodes, setUnvisibleNodes] = useState(0);
  const octreeVisualizationRef = useRef(null);
  const [meshesMap, setMeshesMap] = useState(new Map());
  const [visibleMeshCount, setVisibleMeshCount] = useState(0);
  const [hitNodes, setHitNodes] = useState(0);
  const [hitMeshes, setHitMeshes] = useState(0);
  const [unhitNodes, setUnhitNodes] = useState(0);
  const [meshesInHitNodes, setMeshesInHitNodes] = useState(0);
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    loadFromIndexedDB();

    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const createOctreeVisualization = (octreeNodes) => {
    const octreeGroup = new THREE.Group();
    octreeGroup.name = 'OctreeVisualization';

    const material = new THREE.LineBasicMaterial({ color: 0x00fff0 });

    octreeNodes.forEach((node) => {
      const geometry = new THREE.BoxGeometry(node.size, node.size, node.size);
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(edges, material);
      line.position.set(...node.center);
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

      setLoadingStatus('Loading meshes...');
      // const meshes = await getAllGlbMeshes();
      const id = 'mesh-2c23428'
      //mesh-2c23428
      //mesh-dea54a8
      //mesh-6434438
      const meshes = await getGlbMeshByUserDataId(id)

      if (!octreeNodes.length) throw new Error('No Octree nodes found in IndexedDB');
      // if (!meshes.length) throw new Error('No meshes found in IndexedDB');

      setLoadingStatus('Creating Octree visualization...');
      const octreeVisualization = createOctreeVisualization(octreeNodes);
      sceneRef.current.add(octreeVisualization);
      octreeVisualizationRef.current = octreeVisualization;
      octreeVisualizationRef.current.visible = showOctree;

      setLoadingStatus('Adding meshes to scene...');
      // meshes.forEach((mesh, index) => {

      //   if (!mesh || !mesh.position) {
      //     console.warn(`Invalid mesh data for mesh ${index}, skipping`);
      //     return;
      //   }
        sceneRef.current.add(meshes);
      //   console.log("mesh number scenrRef",mesh.userData.id)
      // });

      setLoadingStatus(`Loaded successfully. Added ${meshes.length} meshes to the scene.`);

      const box = new THREE.Box3().setFromObject(sceneRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
      controlsRef.current.target.set(center.x, center.y, center.z);
      controlsRef.current.update();

    } catch (error) {
      setError(error.message);
      setLoadingStatus('Error occurred while loading.');
    } finally {
      setIsLoading(false);
    }
  };

 


  const toggleOctreeVisibility = () => {
    setShowOctree((prevState) => {
      const newState = !prevState;
      if (octreeVisualizationRef.current) {
        octreeVisualizationRef.current.visible = newState;
      }
      return newState;
    });
  };

  return (
    <div>
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      {isLoading && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
          {loadingStatus}
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,0,0,0.5)', padding: '10px', color: 'white' }}>
          Error: {error}
        </div>
      )}
        {/* <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '10px', color: 'white' }}>
        <div>Ray-hit Octree Nodes: {hitNodes}</div>
        <div>Unhit Octree Nodes: {unhitNodes}</div>
        <div>Meshes in Hit Nodes: {meshesInHitNodes}</div>
      </div>
      */}
      <button 
        onClick={toggleOctreeVisibility} 
        style={{ position: 'absolute', bottom: '10px', left: '10px' }}
      >
        {showOctree ? 'Hide Octree' : 'Show Octree'}
      </button>
    </div>
  );
};

export default LoadDirectScene;