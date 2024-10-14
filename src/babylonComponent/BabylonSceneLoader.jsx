import React, { useRef, useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { openDB } from 'idb';

function BabylonSceneLoader() {
  const canvasRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [engine, setEngine] = useState(null);
  const [status, setStatus] = useState('');
  const [camera, setCamera] = useState(null);

  useEffect(() => {
    if (canvasRef.current) {
      const engine = new BABYLON.Engine(canvasRef.current, true);
      const scene = new BABYLON.Scene(engine);
      
      const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
      camera.attachControl(canvasRef.current, true);
      
      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
      
      setScene(scene);
      setEngine(engine);
      setCamera(camera);
      
      engine.runRenderLoop(() => {
        scene.render();
      });
      
      return () => {
        engine.dispose();
      };
    }
  }, [canvasRef]);

  const loadFromIndexedDB = async () => {
    try {
      setStatus('Loading data from IndexedDB...');
      
      const db = await openDB('ModelStorage', 1);
      
      // Load serialized octree
      const serializedOctree = await db.get('octrees', 'serializedOctree');
      if (!serializedOctree) {
        throw new Error('No octree data found in IndexedDB');
      }
      
      // Deserialize octree
      const octree = deserializeOctree(serializedOctree, scene);
      
      // Load glTF models
      const modelKeys = await db.getAllKeys('models');
      const loadedMeshes = [];
      for (const key of modelKeys) {
        const gltfBlob = await db.get('models', key);
        const meshes = await loadGLTFToScene(gltfBlob, scene, octree, key);
        loadedMeshes.push(...meshes);
      }
      
      // Calculate cumulative bounding box and adjust camera
      if (loadedMeshes.length > 0) {
        const boundingBox = calculateCumulativeBoundingBox(loadedMeshes);
        adjustCameraToFitBoundingBox(camera, boundingBox);
      }
      
      setStatus('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      setStatus(`Error loading data: ${error.message}`);
    }
  };

  const deserializeOctree = (serializedOctree, scene) => {
    const octree = new BABYLON.Octree(serializedOctree.maxDepth);
    
    const deserializeBlock = (serializedBlock) => {
      if (!serializedBlock) return null;
      
      const block = new BABYLON.OctreeBlock(
        new BABYLON.Vector3(serializedBlock.minPoint.x, serializedBlock.minPoint.y, serializedBlock.minPoint.z),
        new BABYLON.Vector3(serializedBlock.maxPoint.x, serializedBlock.maxPoint.y, serializedBlock.maxPoint.z),
        serializedBlock.capacity,
        octree,
        null
      );
      
      block.entries = serializedBlock.entries.map(id => scene.getMeshByID(id)).filter(Boolean);
      block.blocks = serializedBlock.blocks.map(deserializeBlock).filter(Boolean);
      
      return block;
    };
    
    octree.blocks = serializedOctree.blocks.map(deserializeBlock).filter(Boolean);
    octree.entries = serializedOctree.entries.map(id => scene.getMeshByID(id)).filter(Boolean);
    
    return octree;
  };

  const isValidGLB = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const magic = view.getUint32(0, true);
    return magic === 0x46546C67; // "glTF" in little-endian
  };

  const diagnoseGLBFormat = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const length = view.getUint32(8, true);

    let info = `Magic: 0x${magic.toString(16)} (${String.fromCharCode(magic & 0xFF, (magic >> 8) & 0xFF, (magic >> 16) & 0xFF, (magic >> 24) & 0xFF)})\n`;
    info += `Version: ${version}\n`;
    info += `Length: ${length}\n`;
    info += `First 20 bytes: ${[...new Uint8Array(arrayBuffer.slice(0, 20))].map(b => b.toString(16).padStart(2, '0')).join(' ')}`;

    return info;
  };

  const loadGLTFToScene = async (gltfBlob, scene, octree, modelName) => {
    try {
      console.log(`Attempting to load ${modelName}...`);
      
      const gltfJson = JSON.parse(await gltfBlob.text());
      
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.LoadAssetContainer("", "data:" + JSON.stringify(gltfJson), scene, (container) => {
          const meshes = container.meshes;
          meshes.forEach(mesh => {
            mesh.name = `${modelName}_${mesh.name}`;
            scene.addMesh(mesh);
            octree.addMesh(mesh);
          });
          container.addAllToScene();
          console.log(`Successfully loaded ${modelName}`);
          resolve(meshes);
        }, null, (scene, message, exception) => {
          console.error(`Error loading ${modelName}:`, message, exception);
          reject(new Error(`Failed to load ${modelName}: ${message}`));
        });
      });
    } catch (error) {
      console.error(`Error processing ${modelName}:`, error);
      return [];
    }
  };

  const calculateCumulativeBoundingBox = (meshes) => {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    meshes.forEach(mesh => {
      const boundingBox = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, boundingBox.minimumWorld.x);
      minY = Math.min(minY, boundingBox.minimumWorld.y);
      minZ = Math.min(minZ, boundingBox.minimumWorld.z);
      maxX = Math.max(maxX, boundingBox.maximumWorld.x);
      maxY = Math.max(maxY, boundingBox.maximumWorld.y);
      maxZ = Math.max(maxZ, boundingBox.maximumWorld.z);
    });

    return {
      min: new BABYLON.Vector3(minX, minY, minZ),
      max: new BABYLON.Vector3(maxX, maxY, maxZ)
    };
  };

  const adjustCameraToFitBoundingBox = (camera, boundingBox) => {
    const center = BABYLON.Vector3.Center(boundingBox.min, boundingBox.max);
    const diagonal = BABYLON.Vector3.Distance(boundingBox.min, boundingBox.max);
    
    camera.setTarget(center);
    camera.radius = diagonal;
    camera.alpha = -Math.PI / 2;
    camera.beta = Math.PI / 2.5;
  };

  return (
    <div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '400px' }} />
      <button onClick={loadFromIndexedDB}>Load from IndexedDB</button>
      <p>{status}</p>
    </div>
  );
}

export default BabylonSceneLoader;