import * as THREE from 'three'

class Octree {
    constructor(center, size, depth = 0, maxDepth = 4) {
        this.center = center;
        this.size = size;
        this.children = [];
        this.objects = [];
        this.divided = false;
        this.boundingBox = new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size));
        this.maxDepth = maxDepth;  // Maximum depth allowed
        this.depth = depth;
    }

    subdivide() {
        if (this.depth >= this.maxDepth - 1) {
            return;  // Don't subdivide if we've reached the maximum depth
        }

        const { x, y, z } = this.center;
        const newSize = this.size / 2;
        const offset = newSize / 2;
        const newDepth = this.depth + 1;

        this.children = [
            new Octree(new THREE.Vector3(x - offset, y - offset, z - offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x + offset, y - offset, z - offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x - offset, y + offset, z - offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x + offset, y + offset, z - offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x - offset, y - offset, z + offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x + offset, y - offset, z + offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x - offset, y + offset, z + offset), newSize, newDepth, this.maxDepth),
            new Octree(new THREE.Vector3(x + offset, y + offset, z + offset), newSize, newDepth, this.maxDepth),
        ];
        this.divided = true;
    }

    insert(object) {
        if (!this.containsPoint(object.position)) return false;

        if (this.depth >= this.maxDepth || (!this.divided && this.objects.length < 8)) {
            this.objects.push(object);
            return true;
        }

        if (!this.divided) this.subdivide();

        if (this.divided) {
            for (const child of this.children) {
                if (child.insert(object)) return true;
            }
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

    findById(id) {
        for (const object of this.objects) {
            if (object.userData.id === id) {
                return object;
            }
        }

        if (this.divided) {
            for (const child of this.children) {
                const result = child.findById(id);
                if (result) return result;
            }
        }

        return null;
    }

    getDepth() {
        return this.depth;
    }

    getMaxDepth() {
        if (!this.divided) {
            return this.depth;
        }
        return Math.max(...this.children.map(child => child.getMaxDepth()));
    }

    findNodeForPosition(position) {
        if (!this.containsPoint(position)) {
            return null;
        }

        if (this.divided) {
            for (const child of this.children) {
                const foundNode = child.findNodeForPosition(position);
                if (foundNode) {
                    return foundNode;
                }
            }
        }

        return this;
    }
}

export default Octree