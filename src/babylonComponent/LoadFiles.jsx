import React, { useState } from 'react'
import RemoveGeometry from './RemoveGeometry';

function LoadFiles() {
  const [selectedFiles, setSelectedFiles] = useState([]);

   // Choose FBX files
   const onFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };
  return (
  <div>
    <input
    className="button btn"
    type="file"
    multiple
    onChange={onFileChange}
    accept=".fbx"
  />
  <RemoveGeometry selectedFiles={selectedFiles}/>
  </div>
  )
}

export default LoadFiles
