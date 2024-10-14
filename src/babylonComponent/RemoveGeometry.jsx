import React, { useState, useEffect, useRef } from 'react'
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from "three";
import * as BABYLON from "@babylonjs/core";
import SaveConverteGlb from './SaveConverteGlb';
import Simplify from '../components/Simplify';
import OctreeStorage from './OctreeStorage';

function RemoveGeometry({selectedFiles}) {
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [fileSizes, setFileSizes] = useState([]);
    const [convertedModels, setConvertedModels] = useState([]);
    const [boundingBoxData, setBoundingBoxData] = useState(null);
    const [meshObjects, setMeshObjects] = useState([]);
    const [simplificationLevel, setSimplificationLevel] = useState(0);
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const [octree, setOctree] = useState(null); 


    const processModels = async () => {
        const fbxLoader = new FBXLoader();
        
        setIsLoading(true);
        setLoadingProgress(0);
        const simplify = new Simplify();
      
        const objects = [];
        const newFileSizes = [];
        const newConvertedModels = [];
        let cumulativeBoundingBox = new THREE.Box3();
      
        const totalFiles = selectedFiles.length;
        let processedFiles = 0;
      
        for (const file of selectedFiles) {
          try {
            const fbxObject = await new Promise((resolve, reject) => {
              fbxLoader.load(
                URL.createObjectURL(file),
                (object) => {
                  const objectBoundingBox = new THREE.Box3().setFromObject(object);
                  cumulativeBoundingBox.union(objectBoundingBox);
                  resolve(object);
                },
                (xhr) => {
                  if (xhr.lengthComputable) {
                    const fileProgress = xhr.loaded / xhr.total;
                    const overallProgress = (processedFiles + fileProgress) / totalFiles;
                    setLoadingProgress(Math.round(overallProgress * 100));
                  }
                },
                (error) => reject(error)
              );
            });
      
            // Prepare for merging
            const geometries = [];
            const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
      
            fbxObject.traverse((child) => {
              if (child.isMesh) {
                const geometry = child.geometry.clone();
                geometry.applyMatrix4(child.matrixWorld);
                
                if (geometry.attributes.color) {
                  geometry.deleteAttribute("color");
                }
                if (geometry.attributes.uv) {
                  geometry.deleteAttribute("uv");
                }
                if (geometry.attributes.normal) {
                  geometry.deleteAttribute("normal");
                }
                
                geometries.push(geometry);
              }
            });
      
            // Merge geometries
            let mergedGeometry = mergeGeometries(geometries);
            
            // Apply simplification if needed
            if (simplificationLevel > 0) {
              mergedGeometry = simplify.modify(mergedGeometry, simplificationLevel);
            }
      
            const mergedMesh = new THREE.Mesh(mergedGeometry, material);
            objects.push(mergedMesh);
      
            // Convert merged mesh to GLB
            const glbData = await new Promise((resolve, reject) => {
              const exporter = new GLTFExporter();
              exporter.parse(
                mergedMesh,
                (result) => {
                  const output = JSON.stringify(result);
                  resolve(output);
                },
                { binary: false, forceIndices: true, truncateDrawRange: true },
                (error) => reject(error)
              );
            });
           
            const glbBlob = new Blob([glbData], { type: "application/octet-stream" });
           
            newFileSizes.push({
              name: file.name,
              fbxSize: file.size,
              glbSize: glbBlob.size,
            });
      
            newConvertedModels.push({
              fileName: file.name.replace(".fbx", ".glb"),
              data: glbBlob,
            });
      
            processedFiles++;
            setLoadingProgress(Math.round((processedFiles / totalFiles) * 100));
          } catch (error) {
            console.error("Error processing model:", error);
          }
        }

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        cumulativeBoundingBox.getSize(size);
        cumulativeBoundingBox.getCenter(center);

        setBoundingBoxData({
          overallSize: {
            width: size.x,
            height: size.y,
            depth: size.z
          },
          center: {
            x: center.x,
            y: center.y,
            z: center.z
          }
        });

        setFileSizes(newFileSizes);
        setConvertedModels(newConvertedModels);
        setMeshObjects(objects);
        setIsLoading(false);

        // Create Octree
        createOctree(objects, size, center);
      };

    
      const createOctree = (meshes, size, center) => {
        if (!sceneRef.current) return;

        const scene = sceneRef.current;

        // Enable octree optimization for the scene
        const octree = scene.createOrUpdateSelectionOctree(4, new BABYLON.Vector3(size.x, size.y, size.z));

        // Create a dummy root mesh to hold all the merged meshes
        const rootMesh = new BABYLON.Mesh("root", scene);

        // Convert Three.js meshes to Babylon.js meshes
        meshes.forEach((threeMesh, index) => {
            const babylonMesh = new BABYLON.Mesh(`mesh${index}`, scene);
            const positions = threeMesh.geometry.attributes.position.array;
            const indices = threeMesh.geometry.index ? threeMesh.geometry.index.array : null;

            const vertexData = new BABYLON.VertexData();
            vertexData.positions = positions;
            if (indices) {
                vertexData.indices = indices;
            } else {
                // If there are no indices, we need to create them
                vertexData.indices = Array.from({ length: positions.length / 3 }, (_, i) => i);
            }
            vertexData.applyToMesh(babylonMesh);

            babylonMesh.parent = rootMesh;
        });

        // Set the position of the root mesh to the center of the bounding box
        rootMesh.position = new BABYLON.Vector3(center.x, center.y, center.z);

        // Register the root mesh in the octree
        scene.createOrUpdateSelectionOctree();

        console.log("Octree created and meshes registered");
        
        setOctree(octree);  // Store the created octree in state
    };



    return (
        <div>
            <button className='btn btn-primary' onClick={processModels}>Process Files</button>
            {isLoading && (
                <div>
                    <p>Conversion Progress: {loadingProgress}%</p>
                    <progress value={loadingProgress} max="100"></progress>
                </div>
            )}
            <SaveConverteGlb convertedModels={convertedModels}/>
            {boundingBoxData && (
                <div className="bounding-box-info">
                    <h3>Cumulative Bounding Box</h3>
                    <p>Width: {boundingBoxData.overallSize.width.toFixed(2)} units</p>
                    <p>Height: {boundingBoxData.overallSize.height.toFixed(2)} units</p>
                    <p>Depth: {boundingBoxData.overallSize.depth.toFixed(2)} units</p>
                    <h4>Center:</h4>
                    <p>X: {boundingBoxData.center.x.toFixed(2)}</p>
                    <p>Y: {boundingBoxData.center.y.toFixed(2)}</p>
                    <p>Z: {boundingBoxData.center.z.toFixed(2)}</p>
                </div>
            )}
            {octree && convertedModels.length > 0 && (
                <OctreeStorage convertedModels={convertedModels} octree={octree} />
            )}
            <div className="file-sizes">
                {fileSizes.map((file, index) => (
                    <div key={index}>
                        <p>{file.name}</p>
                        <p>FBX size: {(file.fbxSize / 1024 / 1024).toFixed(2)} MB</p>
                        <p>GLB size: {(file.glbSize / 1024 / 1024).toFixed(2)} MB</p>
                        <p>Number of meshes: {file.meshCount}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default RemoveGeometry