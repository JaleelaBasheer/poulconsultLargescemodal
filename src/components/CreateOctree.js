// Octree implementation
import * as THREE from 'three'

class Octree {
    constructor(center, size) {
      this.center = center;
      this.size = size;
      this.children = [];
      this.objects = [];
      this.divided = false;
      this.boundingBox = new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size));
    }
  subdivide() {
    const { x, y, z } = this.center;
    const newSize = this.size / 2;
    const offset = newSize / 2;

    this.children = [
      new Octree(new THREE.Vector3(x - offset, y - offset, z - offset), newSize),
      new Octree(new THREE.Vector3(x + offset, y - offset, z - offset), newSize),
      new Octree(new THREE.Vector3(x - offset, y + offset, z - offset), newSize),
      new Octree(new THREE.Vector3(x + offset, y + offset, z - offset), newSize),
      new Octree(new THREE.Vector3(x - offset, y - offset, z + offset), newSize),
      new Octree(new THREE.Vector3(x + offset, y - offset, z + offset), newSize),
      new Octree(new THREE.Vector3(x - offset, y + offset, z + offset), newSize),
      new Octree(new THREE.Vector3(x + offset, y + offset, z + offset), newSize),
    ];
    this.divided = true;
  }
// insert object to octreee
  insert(object) {
    console.log(object);
    if (!this.containsPoint(object.position)) return false;

    if (this.objects.length < 8 && !this.divided) {
      this.objects.push(object);
      return true;
    }

    if (!this.divided) this.subdivide();

    for (const child of this.children) {
      if (child.insert(object)) return true;
    }

    return false;
  }

  containsPoint(point) {
    return (
      point.x >= this.center.x - this.size / 2 &&
      point.x < this.center.x + this.size / 2 &&
      point.y >= this.center.y - this.size / 2 &&
      point.y < this.center.y + this.size / 2 &&
      point.z >= this.center.z - this.size / 2 &&
      point.z < this.center.z + this.size / 2
    );
  }
  intersectsFrustum(frustum) {
    return frustum.intersectsBox(this.boundingBox);
  }

  getVisibleOctants(frustum) {
    let count = 0;
    if (this.intersectsFrustum(frustum)) {
      count = 1;
      if (this.divided) {
        for (const child of this.children) {
          count += child.getVisibleOctants(frustum);
        }
      }
    }
    return count;
  }
    // Find the node containing the object with a specific id
    findById(id) {
        // Search objects in this node first
        for (const object of this.objects) {
          if (object.userData.id === id) {
            return object;
          }
        }
    
        // If this node has children, search recursively
        if (this.divided) {
          for (const child of this.children) {
            const result = child.findById(id);
            if (result) return result;
          }
        }
    
        // Return null if no matching object is found
        return null;
      }

      // Add this method to the Octree class
findNodeForPosition(position) {
    // First, check if the position is contained in the current octant
    if (!this.containsPoint(position)) {
        return null;
    }

    // If this node is subdivided, check children recursively
    if (this.divided) {
        for (const child of this.children) {
            const foundNode = child.findNodeForPosition(position);
            if (foundNode) {
                return foundNode;
            }
        }
    }

    // If this node is not divided and contains the point, return this node
    return this;
}
}

export default Octree

