/* eslint-disable no-restricted-globals */

// occlusionWorker.js
self.onmessage = function(e) {
    const { octreeNodes, cameraPosition, cameraFrustum } = e.data;
    
    const processedMeshes = octreeNodes.flatMap(node => {
      if (Array.isArray(node.objects)) {
        return node.objects.filter(object => {
          // Implement frustum intersection check here
          // This is a simplified version and may need adjustment based on your specific needs
          const dx = object.position.x - cameraPosition.x;
          const dy = object.position.y - cameraPosition.y;
          const dz = object.position.z - cameraPosition.z;
          const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
          return distance < 1000; // Adjust this value based on your scene scale
        });
      }
      return [];
    });
  
    self.postMessage({ processedMeshes });
  };