import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Simplify from './Simplify.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function FBXViewer() {
  const mountRef = useRef(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(
    new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
  );

  const rendererRef = useRef(new THREE.WebGLRenderer({ antialias: true }));
  const controlsRef = useRef(null);
  const cumulativeBoundingBox = useRef(
    new THREE.Box3(
      new THREE.Vector3(Infinity, Infinity, Infinity),
      new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    )
  );

  const [isVisible, setIsVisible] = useState(true);
  const [fileSizes, setFileSizes] = useState([]);
  const [saveDirectory, setSaveDirectory] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [convertedModels, setConvertedModels] = useState([]);
  const [backgroundColor, setBackgroundColor] = useState(0x000000);
  const [simplificationLevel, setSimplificationLevel] = useState(0.01);
  const [mergedFileSize, setMergedFileSize] = useState(0);
  const DB_NAME = 'GLBModelsDB';
const STORE_NAME = 'models';
const DB_VERSION = 1;

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
    };
  });
};


const storeGLBModel = async (fileName, glbData) => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.put({ fileName, glbData });
};

const getGLBModel = async (fileName) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(fileName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };
  
  const getAllGLBModels = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };
useEffect(()=>{
    openDB();
})

  useEffect(() => {
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(rendererRef.current.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    sceneRef.current.add(directionalLight);

    controlsRef.current = new OrbitControls(
      cameraRef.current,
      rendererRef.current.domElement
    );
    controlsRef.current.enableDamping = true;
    controlsRef.current.dampingFactor = 0.1;

    animate();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      mountRef.current.removeChild(rendererRef.current.domElement);
      controlsRef.current.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    rendererRef.current.setClearColor(backgroundColor);
    // Add an event listener for mouse clicks
window.addEventListener('click', onMouseClick, false);
  }, [backgroundColor]);

  const selectSaveDirectory = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setSaveDirectory(dirHandle);
    } catch (err) {
      console.error("Error selecting directory:", err);
    }
  };
// Create a raycaster and a vector for mouse coordinates
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();



const onMouseClick=(event) =>{
    // Update mouse coordinates based on the click position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Check for intersections with objects in the scene
    const intersects = raycaster.intersectObjects(sceneRef.current.children);

    if (intersects.length > 0) {
        // If an object is clicked, log or highlight it
        const intersectedObject = intersects[0].object;
        console.log('Object clicked:', intersectedObject);

        // Example: Change the color of the clicked object
        intersectedObject.material.color.set(0xff0000);
    }
}

  const onFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  const processModels = async () => {
    const loader = new FBXLoader();
    const objects = [];
    const newFileSizes = [];
    const newConvertedModels = [];
    const simplify = new Simplify();
  
    cumulativeBoundingBox.current = new THREE.Box3(
      new THREE.Vector3(Infinity, Infinity, Infinity),
      new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    );
  
    for (const file of selectedFiles) {
      try {
        const fbxObject = await new Promise((resolve, reject) => {
          loader.load(
            URL.createObjectURL(file),
            (object) => resolve(object),
            undefined,
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
    
  
        const glbData = await new Promise((resolve, reject) => {
          const exporter = new GLTFExporter();
          exporter.parse(
            mergedMesh,
            (result) => {
              if (result instanceof ArrayBuffer) {
                resolve(result);
              } else {
                const blob = new Blob([JSON.stringify(result)], {
                  type: "application/json",
                });
                blob.arrayBuffer().then(resolve).catch(reject);
              }
            },
            { binary: true },
            (error) => reject(error)
          );
        });

  
        const gltfLoader = new GLTFLoader();
        const gltfObject = await new Promise((resolve, reject) => {
          gltfLoader.parse(glbData, "", (gltf) => resolve(gltf.scene), reject);
        });
  
        // Count the number of meshes in the GLB object
        let meshCount = 0;
        gltfObject.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
          }
        });
  
        objects.push(gltfObject);
        const boundingBox = new THREE.Box3().setFromObject(gltfObject);
        cumulativeBoundingBox.current.union(boundingBox);
  
        newFileSizes.push({
          name: file.name,
          fbxSize: file.size,
          glbSize: glbData.byteLength,
          meshCount: meshCount
        });
  
        const blob = new Blob([glbData], { type: "application/octet-stream" });
        newConvertedModels.push({
          fileName: file.name.replace(".fbx", ".glb"),
          data: blob,
        });
        const fileName = file.name.replace(".fbx", ".glb");
        // await storeGLBModel(fileName, glbData);
      } catch (error) {
        console.error("Error processing model:", error);
      }
    }
    const mergedGLBData = await mergeGLBFiles(objects);
    const mergedSize = mergedGLBData.byteLength;
  
    // Generate a unique name for the merged GLB
    const timestamp = Date.now();
    const mergedFileName = `merged_${timestamp}.glb`;
  
    // Store merged GLB in IndexedDB
    await storeGLBModel(mergedFileName, mergedGLBData);
  
    objects.forEach((obj) => {
      sceneRef.current.add(obj)   
    });
    console.log(objects.length);
    adjustCamera();
    setFileSizes(newFileSizes);
    setConvertedModels(newConvertedModels);
  
    // Set merged file size
    setMergedFileSize(prevSize => prevSize + mergedSize);
    
  };

  const mergeGLBFiles = async (glbObjects) => {
    const mergedScene = new THREE.Scene();
    
    glbObjects.forEach((obj) => {
      mergedScene.add(obj.clone());
    });
  
    const glbData = await new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        mergedScene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const blob = new Blob([JSON.stringify(result)], {
              type: "application/json",
            });
            blob.arrayBuffer().then(resolve).catch(reject);
          }
        },
        { binary: true },
        (error) => reject(error)
      );
    });
  
    return glbData;
  };
  const handleSimplificationLevel = (level) => {
    setSimplificationLevel(level);
  };

  const saveConvertedModels = async () => {
    if (!saveDirectory) {
      alert("Please select a save directory first.");
      return;
    }

    if (convertedModels.length === 0) {
      alert(
        "No models have been processed yet. Please process models before saving."
      );
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const model of convertedModels) {
      try {
        const newHandle = await saveDirectory.getFileHandle(model.fileName, {
          create: true,
        });
        const writable = await newHandle.createWritable();
        await writable.write(model.data);
        await writable.close();
        successCount++;
      } catch (error) {
        console.error("Error saving file:", model.fileName, error);
        failCount++;
      }
    }

    alert(
      `Saving complete!\n${successCount} files saved successfully.\n${failCount} files failed to save.`
    );
  };

  const adjustCamera = () => {
    const center = new THREE.Vector3();
    cumulativeBoundingBox.current.getCenter(center);
    const size = cumulativeBoundingBox.current.getSize(new THREE.Vector3());
    const distance = size.length();
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = distance / (2 * Math.tan(fov / 2));
    cameraZ *= 2.5;

    cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  const animate = () => {
    requestAnimationFrame(animate);
    if (isVisible) {
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const toggleVisibility = (visible) => {
    setIsVisible(visible);
    sceneRef.current.traverse(function (object) {
      if (object instanceof THREE.Mesh) {
        object.visible = visible;
      }
    });
  };

  const resetCameraView = () => {
    const center = new THREE.Vector3();
    cumulativeBoundingBox.current.getCenter(center);
    const size = cumulativeBoundingBox.current.getSize(new THREE.Vector3());
    const distance = size.length();
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = distance / (2 * Math.tan(fov / 2));
    cameraZ *= 2.5;

    cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
    cameraRef.current.lookAt(center);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };
  const loadModelsFromIndexedDB = async () => {
    try {
      const models = await getAllGLBModels();
      console.log("Models retrieved from IndexedDB:", models);
  
      if (!Array.isArray(models) || models.length === 0) {
        console.log("No models found in IndexedDB");
        return;
      }
  
      const objects = [];
      const newFileSizes = [];
  
      for (const model of models) {
        if (!model.glbData) {
          console.warn(`Model ${model.fileName} has no glbData`);
          continue;
        }
  
        const gltfLoader = new GLTFLoader();
        const gltfObject = await new Promise((resolve, reject) => {
          gltfLoader.parse(model.glbData, "", (gltf) => resolve(gltf.scene), reject);
        });
  
        sceneRef.current.add(gltfObject)   

        let meshCount = 0;
        gltfObject.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
          }
        });
  
        objects.push(gltfObject);
        const boundingBox = new THREE.Box3().setFromObject(gltfObject);
        cumulativeBoundingBox.current.union(boundingBox);
  
        newFileSizes.push({
          name: model.fileName,
          glbSize: model.glbData.byteLength,
          meshCount: meshCount
        });
      }
  
      objects.forEach((obj) => {
        // sceneRef.current.add(obj)   
      });
      console.log(`Loaded ${objects.length} models from IndexedDB`);
      adjustCamera();
      setFileSizes(newFileSizes);
    } catch (error) {
      console.error("Error loading models from IndexedDB:", error);
    }
  };


// const loadModelsFromIndexedDB = async () => {
//   try {
//     const allModels = await getAllGLBModels();
//     const mergedModels = allModels.filter(model => model.fileName.startsWith("merged_"));
    
//     if (mergedModels.length === 0) {
//       console.log("No merged models found in IndexedDB");
//       return;
//     }

//     // Clear existing objects from the scene
//     sceneRef.current.children = sceneRef.current.children.filter(child => !(child instanceof THREE.Group));

//     let totalSize = 0;
//     let totalMeshCount = 0;

//     // Generate an array of distinct colors
//     const colors = generateDistinctColors(mergedModels.length);

//     for (let i = 0; i < mergedModels.length; i++) {
//       const mergedModel = mergedModels[i];
//       if (!mergedModel.glbData) {
//         console.warn(`Model ${mergedModel.fileName} has no glbData`);
//         continue;
//       }

//       const gltfLoader = new GLTFLoader();
//       const gltfObject = await new Promise((resolve, reject) => {
//         gltfLoader.parse(mergedModel.glbData, "", (gltf) => resolve(gltf.scene), reject);
//       });

//       let meshCount = 0;
//       const color = colors[i];
//       gltfObject.traverse((child) => {
//         if (child.isMesh) {
//           meshCount++;
//           // Assign a new material with the generated color
//           child.material = new THREE.MeshPhongMaterial({ color: color });
//         }
//       });

//       // Add merged object to the scene
//       sceneRef.current.add(gltfObject);

//       const boundingBox = new THREE.Box3().setFromObject(gltfObject);
//       cumulativeBoundingBox.current.union(boundingBox);

//       totalSize += mergedModel.glbData.byteLength;
//       totalMeshCount += meshCount;

//       console.log(`Loaded merged model ${mergedModel.fileName} with ${meshCount} meshes and color ${color.getHexString()}`);
//     }

//     setFileSizes([{
//       name: "All Merged GLBs",
//       glbSize: totalSize,
//       meshCount: totalMeshCount
//     }]);

//     setMergedFileSize(totalSize);

//     console.log(`Loaded ${mergedModels.length} merged models with a total of ${totalMeshCount} meshes from IndexedDB`);
//     adjustCamera();
//   } catch (error) {
//     console.error("Error loading merged models from IndexedDB:", error);
//   }
// };

// Helper function to generate distinct colors
const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = i / count;
    const color = new THREE.Color().setHSL(hue, 1, 0.5);
    colors.push(color);
  }
  return colors;
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
     
        <button onClick={processModels}>Process Models</button>
        <button onClick={saveConvertedModels}>Save Converted Models</button>
        <button onClick={loadModelsFromIndexedDB}>Load from IndexedDB</button>
        <div ref={mountRef} style={{ width: "99%", height: "100vh" }}></div>
      </div>

      <div className="button-container">
        <button
          className="custom-button hide-show"
          onClick={() => toggleVisibility(true)}
        >
view
        </button>
        <button
          className="custom-button"
          onClick={() => toggleVisibility(false)}
        >
         hide
        </button>
        <button className="custom-button fit-view" onClick={resetCameraView}>
         fit view
        </button>
        <input
          type="color"
          value={"#" + backgroundColor.toString(16).padStart(6, "0")}
          onChange={(e) =>
            setBackgroundColor(parseInt(e.target.value.slice(1), 16))
          }
        />
      </div>

      <div className="file-sizes">
      {mergedFileSize > 0 && (
    <div>
      <p>Total Merged GLB size: {(mergedFileSize / 1024 / 1024).toFixed(2)} MB</p>
    </div>
  )}
        {fileSizes.map((file, index) => (
          <div key={index}>
            <p>{file.name}</p>
            <p>FBX size: {(file.fbxSize / 1024 / 1024).toFixed(2)} MB</p>
            <p>glTF size: {(file.glbSize / 1024 / 1024).toFixed(2)} MB</p>
            <p>Number of meshes: {file.meshCount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FBXViewer;