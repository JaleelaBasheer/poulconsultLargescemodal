import React, {useState} from 'react'
import JSZip from "jszip";  // Import JSZip


function SaveConverteGlb({convertedModels}) {
    const [saveProgress, setSaveProgress] = useState(0);
    const [saveDirectory, setSaveDirectory] = useState(null);

 // Choose folder to save glb files
 const selectSaveDirectory = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setSaveDirectory(dirHandle);
    } catch (err) {
      console.error("Error selecting directory:", err);
    }
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
    } catch (error) {
      console.error("Error saving ZIP file:", error);
    }
  };
  return (
    <div>
    <button onClick={selectSaveDirectory}>Select Save Directory</button>
    <button onClick={saveConvertedModels}>Save ZIP file</button>
      
    </div>
  )
}

export default SaveConverteGlb
