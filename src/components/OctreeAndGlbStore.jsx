
import React, { useEffect } from 'react';
import { openDB } from 'idb';
import * as THREE from 'three';

const DB_NAME = 'OctreeGlbDB';
const OCTREE_STORE = 'octreeNodes';
const GLB_STORE = 'glbMeshes';
const DB_VERSION = 4; // Increment the version to trigger an upgrade

// Helper function to generate a valid ID for IndexedDB
const generateValidId = (prefix, index) => `${prefix}_${index}`;

// Helper function to serialize Octree node
const serializeNode = (node, index) => {
  return {
    id: generateValidId('node', index),
    center: node.center.toArray(),
    size: node.size,
    objects: node.objects.map(obj => ({
      position: obj.position.toArray(),
      radius: obj.radius,
      userData: JSON.parse(JSON.stringify(obj.userData))
    })),
    children: node.children ? node.children.map((child, i) => generateValidId('node', `${index}_${i}`)) : null
  };
};

// Helper function to deserialize Octree node
const deserializeNode = (data) => {
  return {
    ...data,
    center: new THREE.Vector3().fromArray(data.center),
    objects: data.objects.map(obj => ({
      ...obj,
      position: new THREE.Vector3().fromArray(obj.position)
    }))
  };
};

// Helper function to serialize GLB mesh
const serializeMesh = (mesh, index) => {
  if (!mesh) {
    console.error(`Mesh at index ${index} is undefined`);
    return null;
  }

  const serialized = {
    id: generateValidId('mesh', index),
    name: mesh.name || `Unnamed_Mesh_${index}`,
    userData: JSON.parse(JSON.stringify(mesh.userData || {})),
    position: mesh.position ? mesh.position.toArray() : [0, 0, 0],
    rotation: mesh.rotation ? mesh.rotation.toArray() : [0, 0, 0],
    scale: mesh.scale ? mesh.scale.toArray() : [1, 1, 1],
  };

  if (mesh.geometry) {
    serialized.geometry = {
      type: mesh.geometry.type || 'BufferGeometry',
      parameters: mesh.geometry.parameters || {},
      attributes: {}
    };

    if (mesh.geometry.attributes) {
      Object.entries(mesh.geometry.attributes).forEach(([key, attr]) => {
        if (attr && attr.array && attr.itemSize) {
          serialized.geometry.attributes[key] = {
            array: Array.from(attr.array),
            itemSize: attr.itemSize,
            count: attr.count,
          };
        }
      });
    }
  }

  if (mesh.material) {
    serialized.material = {
      type: mesh.material.type || 'MeshBasicMaterial',
      color: mesh.material.color ? mesh.material.color.getHex() : null,
      // Add other material properties as needed
    };
  }

  return serialized;
};

// Helper function to deserialize GLB mesh
const deserializeMesh = (data) => {
    if (!data) {
      console.error('Mesh data is null or undefined');
      return null;
    }
  
    console.log('Deserializing mesh:', data.id); // Debug log
    console.log('Deserializing mesh:', data.userData.id); // Debug log

  
    let geometry;
    if (data.geometry && data.geometry.type && THREE[data.geometry.type]) {
      try {
        const parameters = data.geometry.parameters || {};
        geometry = new THREE[data.geometry.type](...Object.values(parameters));
        
        if (data.geometry.attributes) {
          Object.entries(data.geometry.attributes).forEach(([key, attr]) => {
            if (attr && attr.array && attr.itemSize) {
              geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(attr.array), attr.itemSize));
            }
          });
        }
      } catch (error) {
        console.error('Error creating geometry:', error);
        // Fallback to a simple geometry
        geometry = new THREE.BoxGeometry(1, 1, 1);
      }
    } else {
      console.warn('Invalid geometry data, using fallback');
      geometry = new THREE.BoxGeometry(1, 1, 1);
    }
  
    let material;
    if (data.material && data.material.type && THREE[data.material.type]) {
      try {
        material = new THREE[data.material.type]();
        if (data.material.color) material.color.setHex(data.material.color);
      } catch (error) {
        console.error('Error creating material:', error);
        // Fallback to a simple material
        material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      }
    } else {
      console.warn('Invalid material data, using fallback');
      material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    }
  
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = data.name || `Mesh_${data.id}`;
    mesh.userData = data.userData || {};
    
    if (Array.isArray(data.position) && data.position.length === 3) {
      mesh.position.fromArray(data.position);
    } else {
      console.warn(`Invalid position data for mesh ${data.id}, using default`);
      mesh.position.set(0, 0, 0);
    }
    
    if (Array.isArray(data.rotation) && data.rotation.length === 3) {
      mesh.rotation.fromArray(data.rotation);
    }
    
    if (Array.isArray(data.scale) && data.scale.length === 3) {
      mesh.scale.fromArray(data.scale);
    }
  
    return mesh;
  };

  export const storeOctreeNode = async (node, index) => {
    const db = await initializeDatabase();
    const serializedNode = serializeNode(node, index);
    await db.put(OCTREE_STORE, serializedNode);
    db.close();
  };
  
  export const getOctreeNode = async (nodeId) => {
    const db = await initializeDatabase();
    const node = await db.get(OCTREE_STORE, nodeId);
    db.close();
    return node ? deserializeNode(node) : null;
  };

export const getAllOctreeNodes = async () => {
  const db = await openDB(DB_NAME, DB_VERSION);
  const nodes = await db.getAll(OCTREE_STORE);
  db.close();
  return nodes.map(deserializeNode);
};

export const storeGlbMesh = async (mesh, index) => {
  const db = await openDB(DB_NAME, DB_VERSION);
  const serializedMesh = serializeMesh(mesh, index);
  await db.put(GLB_STORE, serializedMesh);
  db.close();
};

export const getGlbMesh = async (meshId) => {
  const db = await openDB(DB_NAME, DB_VERSION);
  const mesh = await db.get(GLB_STORE, meshId);
  db.close();
  return mesh ? deserializeMesh(mesh) : null;
};

export const getAllGlbMeshes = async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const meshesData = await db.getAll(GLB_STORE);
    db.close();
    
    console.log(`Retrieved ${meshesData.length} meshes from IndexedDB`); // Debug log
    
    return meshesData.map(data => {
      const mesh = deserializeMesh(data);
      if (!mesh) {
        console.warn(`Failed to deserialize mesh with id: ${data.id}`);
        return null;
      }
      return mesh;
    }).filter(mesh => mesh !== null);
  };

  export const getGlbMeshById = async (id) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const meshData = await db.get(GLB_STORE, id);
    db.close();
    
    if (!meshData) {
      console.warn(`No mesh found with id: ${id}`);
      return null;
    }
    
    console.log(`Retrieved mesh data for id: ${id}`); // Debug log
    return deserializeMesh(meshData);
  };
  
  export const getGlbMeshByUserDataId = async (userDataId) => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(GLB_STORE, 'readonly');
    const store = tx.objectStore(GLB_STORE);
  
    let foundMeshData = null;
    
    // Iterate over all objects in the store
    await store.openCursor().then(function iterateCursor(cursor) {
      if (!cursor) return;
      
      const meshData = cursor.value;
      if (meshData.userData && meshData.userData.id === userDataId) {
        foundMeshData = meshData;
        return; // Stop once we find the mesh
      }
      
      return cursor.continue().then(iterateCursor);
    });
  
    db.close();
    
    if (!foundMeshData) {
      console.warn(`No mesh found with userData.id: ${userDataId}`);
      return null;
    }
    
    console.log(`Retrieved mesh data for userData.id: ${userDataId}`); // Debug log
    return deserializeMesh(foundMeshData);
  };
  const initializeDatabase = async () => {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
        
        if (!db.objectStoreNames.contains(OCTREE_STORE)) {
          console.log(`Creating object store: ${OCTREE_STORE}`);
          db.createObjectStore(OCTREE_STORE, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(GLB_STORE)) {
          console.log(`Creating object store: ${GLB_STORE}`);
          db.createObjectStore(GLB_STORE, { keyPath: 'id' });
        }
      },
    });
  };
  
  const OctreeAndGlbStore = ({ octreeRoot, glbMeshes }) => {
    useEffect(() => {
      const storeData = async () => {
        try {
          const db = await initializeDatabase();
  
          // Check if the stores exist before creating transactions
          if (!db.objectStoreNames.contains(OCTREE_STORE) || !db.objectStoreNames.contains(GLB_STORE)) {
            console.error('Required object stores are missing. Database might not be properly initialized.');
            return;
          }
  
          // Store Octree nodes
          if (octreeRoot) {
            const octreeTx = db.transaction(OCTREE_STORE, 'readwrite');
            const octreeStore = octreeTx.objectStore(OCTREE_STORE);
            
            let nodeIndex = 0;
            const storeNode = async (node) => {
              const serializedNode = serializeNode(node, nodeIndex++);
              await octreeStore.put(serializedNode);
              if (node.children) {
                for (const child of node.children) {
                  await storeNode(child);
                }
              }
            };
            await storeNode(octreeRoot);
            await octreeTx.done;
          }
  
          // Store GLB meshes
          if (glbMeshes && glbMeshes.length > 0) {
            const glbTx = db.transaction(GLB_STORE, 'readwrite');
            const glbStore = glbTx.objectStore(GLB_STORE);
            for (let i = 0; i < glbMeshes.length; i++) {
              const serializedMesh = serializeMesh(glbMeshes[i], i);
              await glbStore.put(serializedMesh);
            }
            await glbTx.done;
          }
  
          db.close();
        } catch (error) {
          console.error('Error in OctreeAndGlbStore:', error);
        }
      };
  
      storeData();
    }, [octreeRoot, glbMeshes]);
  
    return null; // This component doesn't render anything
  };
  
  export default OctreeAndGlbStore;