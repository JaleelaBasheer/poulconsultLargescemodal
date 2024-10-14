import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { getAllOctreeNodes, getAllGlbMeshes, getGlbMeshByUserDataId } from './OctreeAndGlbStore';

const BabylonComponent = () => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRef = useRef(null);
  const octreeRef = useRef(null);
  const octreeVisualizationRef = useRef(null);
  const [loadedMeshes, setLoadedMeshes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [showOctree, setShowOctree] = useState(true);

  const resizeScene = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resize();
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const engine = new BABYLON.Engine(canvasRef.current, true);
      const scene = new BABYLON.Scene(engine);

      engineRef.current = engine;
      sceneRef.current = scene;

      const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
      camera.attachControl(canvasRef.current, true);
      cameraRef.current = camera;

      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      engine.runRenderLoop(() => {
        scene.render();
      });

      window.addEventListener('resize', resizeScene);

      loadFromIndexedDB();
    }

    return () => {
      window.removeEventListener('resize', resizeScene);
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, [resizeScene]);

  const createOctreeVisualization = (octreeNodes) => {
    const octreeMeshes = [];
    const material = new BABYLON.StandardMaterial("octreeMaterial", sceneRef.current);
    material.wireframe = true;
    material.emissiveColor = new BABYLON.Color3(0, 1, 1);

    octreeNodes.forEach((node) => {
      const box = BABYLON.MeshBuilder.CreateBox("octreeNode", { size: node.size }, sceneRef.current);
      box.position = new BABYLON.Vector3(...node.center);
      box.material = material;
      box.isPickable = false;
      octreeMeshes.push(box);
    });

    return octreeMeshes;
  };

  const createBabylonMeshFromThreeMesh = (threeMesh) => {
    const babylonMesh = new BABYLON.Mesh(threeMesh.name, sceneRef.current);

    // Convert geometry
    const positions = threeMesh.geometry.attributes.position.array;
    const normals = threeMesh.geometry.attributes.normal ? threeMesh.geometry.attributes.normal.array : null;
    const indices = threeMesh.geometry.index ? threeMesh.geometry.index.array : null;

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    if (normals) vertexData.normals = normals;
    if (indices) vertexData.indices = indices;

    vertexData.applyToMesh(babylonMesh);

    // Set transform
    babylonMesh.position = new BABYLON.Vector3(
      threeMesh.position.x,
      threeMesh.position.y,
      threeMesh.position.z
    );
    babylonMesh.rotation = new BABYLON.Vector3(
      threeMesh.rotation.x,
      threeMesh.rotation.y,
      threeMesh.rotation.z
    );
    babylonMesh.scaling = new BABYLON.Vector3(
      threeMesh.scale.x,
      threeMesh.scale.y,
      threeMesh.scale.z
    );

    // Create and assign material
    const material = new BABYLON.StandardMaterial(threeMesh.name + "_material", sceneRef.current);
    if (threeMesh.material) {
      material.diffuseColor = new BABYLON.Color3(
        threeMesh.material.color.r,
        threeMesh.material.color.g,
        threeMesh.material.color.b
      );
    } else {
      // Default color if no material is present
      material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    }
    babylonMesh.material = material;

    return babylonMesh;
  };

  const loadFromIndexedDB = async () => {
    try {
      setLoadingStatus('Loading Octree nodes...');
      const octreeNodes = await getAllOctreeNodes();
      octreeRef.current = octreeNodes;

      setLoadingStatus('Loading meshes...');
      const meshes = await getAllGlbMeshes();

      if (!octreeNodes.length) throw new Error('No Octree nodes found in IndexedDB');
      if (!meshes.length) throw new Error('No meshes found in IndexedDB');

      setLoadingStatus('Creating Octree visualization...');
      const octreeVisualization = createOctreeVisualization(octreeNodes);
      octreeVisualizationRef.current = octreeVisualization;
      octreeVisualizationRef.current.forEach(mesh => {
        mesh.setEnabled(showOctree);
      });

      setLoadingStatus('Adding meshes to scene...');
      const loadedMeshesArray = [];
      for (const meshData of meshes) {
        try {
          console.log('Mesh data:', meshData);
          const babylonMesh = createBabylonMeshFromThreeMesh(meshData);
          loadedMeshesArray.push(babylonMesh);
          sceneRef.current.addMesh(babylonMesh);
        } catch (meshError) {
          console.error(`Error loading mesh ${meshData.name}:`, meshError);
        }
      }

      setLoadedMeshes(loadedMeshesArray);
      setLoadingStatus(`Loaded successfully. Added ${loadedMeshesArray.length} meshes to the scene.`);

      // Adjust camera to fit all meshes
      const boundingInfo = calculateSceneBoundingBox(loadedMeshesArray);
      adjustCameraToFitMeshes(boundingInfo);

    } catch (error) {
      console.error('Error in loadFromIndexedDB:', error);
      setError(error.message);
      setLoadingStatus('Error occurred while loading.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSceneBoundingBox = (meshes) => {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach(mesh => {
      const boundingInfo = mesh.getBoundingInfo();
      const meshMin = boundingInfo.boundingBox.minimumWorld;
      const meshMax = boundingInfo.boundingBox.maximumWorld;

      min = BABYLON.Vector3.Minimize(min, meshMin);
      max = BABYLON.Vector3.Maximize(max, meshMax);
    });

    return new BABYLON.BoundingInfo(min, max);
  };

  const adjustCameraToFitMeshes = (boundingInfo) => {
    const center = boundingInfo.boundingBox.centerWorld;
    const diagonal = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
    const radius = diagonal.length() / 2;

    cameraRef.current.setPosition(new BABYLON.Vector3(
      center.x,
      center.y,
      center.z + radius * 2
    ));
    cameraRef.current.setTarget(center);
  };

  const toggleOctreeVisibility = () => {
    setShowOctree(prevState => {
      const newState = !prevState;
      if (octreeVisualizationRef.current) {
        octreeVisualizationRef.current.forEach(mesh => {
          mesh.setEnabled(newState);
        });
      }
      return newState;
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
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
      <button 
        onClick={toggleOctreeVisibility} 
        style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10 }}
      >
        {showOctree ? 'Hide Octree' : 'Show Octree'}
      </button>
    </div>
  );
};

export default BabylonComponent;