import * as THREE from 'three';

class Simplify {
  constructor() {
    this.triangleCount = 0;
  }

  modify(geometry, percentage) {
    if (!geometry.isBufferGeometry) {
      console.log('Simplify: Geometry is not a BufferGeometry.');
      return geometry;
    }

    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;

    // Convert to non-indexed geometry if necessary
    let triangles = [];
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        triangles.push([
          new THREE.Vector3(positions[indices[i] * 3], positions[indices[i] * 3 + 1], positions[indices[i] * 3 + 2]),
          new THREE.Vector3(positions[indices[i + 1] * 3], positions[indices[i + 1] * 3 + 1], positions[indices[i + 1] * 3 + 2]),
          new THREE.Vector3(positions[indices[i + 2] * 3], positions[indices[i + 2] * 3 + 1], positions[indices[i + 2] * 3 + 2])
        ]);
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        triangles.push([
          new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]),
          new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]),
          new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8])
        ]);
      }
    }

    this.triangleCount = triangles.length;
    const targetCount = Math.floor(this.triangleCount * (1 - percentage));

    while (triangles.length > targetCount) {
      const leastSignificantTriangle = this.findLeastSignificantTriangle(triangles);
      this.removeTriangle(triangles, leastSignificantTriangle);
    }

    // Convert back to BufferGeometry
    const newPositions = [];
    const newIndices = [];
    const vertexMap = new Map();

    triangles.forEach((triangle, i) => {
      triangle.forEach((vertex) => {
        const key = `${vertex.x},${vertex.y},${vertex.z}`;
        if (!vertexMap.has(key)) {
          vertexMap.set(key, newPositions.length / 3);
          newPositions.push(vertex.x, vertex.y, vertex.z);
        }
        newIndices.push(vertexMap.get(key));
      });
    });

    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    newGeometry.setIndex(newIndices);
    newGeometry.computeVertexNormals();

    return newGeometry;
  }

  findLeastSignificantTriangle(triangles) {
    let leastSignificant = 0;
    let minArea = Infinity;

    for (let i = 0; i < triangles.length; i++) {
      const area = this.calculateTriangleArea(triangles[i]);
      if (area < minArea) {
        minArea = area;
        leastSignificant = i;
      }
    }

    return leastSignificant;
  }

  removeTriangle(triangles, index) {
    triangles.splice(index, 1);
  }

  calculateTriangleArea(triangle) {
    const a = triangle[0].distanceTo(triangle[1]);
    const b = triangle[1].distanceTo(triangle[2]);
    const c = triangle[2].distanceTo(triangle[0]);
    const s = (a + b + c) / 2;
    return Math.sqrt(s * (s - a) * (s - b) * (s - c));
  }
}

export default Simplify;