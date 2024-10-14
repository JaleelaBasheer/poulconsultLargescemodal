import React, { useEffect, useState,useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import JSZip from "jszip";  // Import JSZip
import Octree from "./CreateOctree";
import {GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import OctreeAndGlbStore, { storeOctreeNode, getOctreeNode, getAllOctreeNodes } from "./OctreeAndGlbStore";
import { v4 as uuidv4 } from 'uuid';
import Simplify from './Simplify.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function FbxToGlbConverter() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [fileSizes, setFileSizes] = useState([]);
  const [saveDirectory, setSaveDirectory] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [convertedModels, setConvertedModels] = useState([]);
  const [boundingBoxData, setBoundingBoxData] = useState(null);
  const octreeRef = useRef(null);
  const [meshObjects,setMeshObjects] = useState([])
  const [simplificationLevel, setSimplificationLevel] =  useState(0);;

  // Choose folder to save glb files
  const selectSaveDirectory = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setSaveDirectory(dirHandle);
    } catch (err) {
      console.error("Error selecting directory:", err);
    }
  };

  // Choose FBX files
  const onFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  // Calculate bounding box while processing models
  const processModels = async () => {
    const fbxLoader = new FBXLoader();
    const gltfLoader = new GLTFLoader();
    
    setIsLoading(true);
    setLoadingProgress(0);
  
    const objects = [];
    const newFileSizes = [];
    const newConvertedModels = [];
    let cumulativeBoundingBox = new THREE.Box3();
    const simplify = new Simplify();
  
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
  
        const glbObject = await new Promise((resolve, reject) => {
          gltfLoader.parse(glbData, "", (glb) => resolve(glb.scene), reject);
        });
  
        const uuid = uuidv4().substring(0, 7);
        const boundingBox = new THREE.Box3().setFromObject(glbObject);
        const meshId = `mesh-${uuid}`;
        glbObject.userData.id = meshId;
        glbObject.userData.position = boundingBox.getCenter(new THREE.Vector3());
        glbObject.userData.size = boundingBox.getSize(new THREE.Vector3()).length() / 2;
        objects.push(glbObject);
  
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
  
    // After processing all files
    const size = cumulativeBoundingBox.getSize(new THREE.Vector3());
    const center = cumulativeBoundingBox.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const boundingBoxData = {
      overallSize: {
        width: size.x,
        height: size.y,
        depth: size.z,
      },
      center: {
        x: center.x,
        y: center.y,
        z: center.z,
      },
    };
    octreeRef.current = new Octree(center, maxSize);
  
    objects.forEach((obj, index) => {
      const boundingBox = new THREE.Box3().setFromObject(obj);
      octreeRef.current.insert({
        position: boundingBox.getCenter(new THREE.Vector3()),
        radius: boundingBox.getSize(new THREE.Vector3()).length() / 2,
        userData: {
          id: obj.userData.id,
          index: index,
          mesh: obj
        }
      });
    });
  
    setBoundingBoxData(boundingBoxData);
    setFileSizes(newFileSizes);
    setConvertedModels(newConvertedModels);
    setMeshObjects(objects);
    setIsLoading(false);
  };


  // Save converted models as a ZIP file
  const saveConvertedModels = async () => {
    if (!saveDirectory) {
      alert("Please select a save directory first.");
      return;
    }

    if (convertedModels.length === 0) {
      alert("No models have been processed yet. Please process models before saving.");
      return;
    }

    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;
    setSaveProgress(0);

    // Add each converted model to the ZIP archive
    for (const model of convertedModels) {
      zip.file(model.fileName, model.data);
    }

    try {
      // Generate a unique filename with a timestamp
      const timestamp = new Date().toISOString().replace(/[:.-]/g, "_"); // Example: 2024_09_01T12_00_00
      const zipFilename = `pods_zipped_files_${timestamp}.zip`;

      const zipBlob = await zip.generateAsync({
        type: "blob",
        streamFiles: true, // Enable streaming to track progress
        compression: "DEFLATE", // Optional: compress the files
      }, (metadata) => {
        setSaveProgress(Math.round(metadata.percent));
      });

      const zipFileHandle = await saveDirectory.getFileHandle(zipFilename, {
        create: true,
      });
      const writable = await zipFileHandle.createWritable();
      await writable.write(zipBlob);
      await writable.close();

      successCount = convertedModels.length;
      alert(`ZIP file saved successfully with ${successCount} files as ${zipFilename}.`);
      setIsLoading(false);
    } catch (error) {
      console.error("Error saving ZIP file:", error);
    }
  };

  return (
    <div className="main">
      <div className="canvas-container">
        <button onClick={selectSaveDirectory}>Select Save Directory</button>
        <input
          className="button"
          type="file"
          multiple
          onChange={onFileChange}
          accept=".fbx"
        />
        <button onClick={processModels}>Process files</button>
        <button onClick={saveConvertedModels}>Save ZIP file</button>
      </div>
      {/* Progress bars */}
      {isLoading && (
        <div>
          <p>Conversion Progress: {loadingProgress}%</p>
          <progress value={loadingProgress} max="100"></progress>
        </div>
      )}
      {saveProgress > 0 && (
        <div>
          <p>Saving Progress: {saveProgress}%</p>
          <progress value={saveProgress} max="100"></progress>
        </div>
      )}
      <OctreeAndGlbStore octreeRoot={octreeRef.current} glbMeshes={meshObjects} />
      {/* Display the calculated bounding box info */}
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
  );
}

export default FbxToGlbConverter;
