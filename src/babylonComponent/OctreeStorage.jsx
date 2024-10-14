import React, { useState, useEffect } from 'react';
import * as BABYLON from "@babylonjs/core";
import { openDB } from 'idb';

function OctreeStorage({ convertedModels, octree }) {
    const [storageStatus, setStorageStatus] = useState('');

    useEffect(() => {
        if (convertedModels.length > 0 && octree) {
            storeData();
        }
    }, [convertedModels, octree]);

    const storeData = async () => {
        try {
            setStorageStatus('Storing data...');

            // Open IndexedDB
            const db = await openDB('ModelStorage', 1, {
                upgrade(db) {
                    db.createObjectStore('models');
                    db.createObjectStore('octrees');
                },
            });

            // Store GLB files
            for (const model of convertedModels) {
                await db.put('models', model.data, model.fileName);
            }

            // Log octree structure for debugging
            console.log('Original Octree:', octree);

            // Serialize octree
            const serializedOctree = serializeOctree(octree);
            console.log('Serialized Octree:', serializedOctree);

            // Store serialized octree
            await db.put('octrees', serializedOctree, 'serializedOctree');

            setStorageStatus('Data stored successfully');
        } catch (error) {
            console.error('Error storing data:', error);
            setStorageStatus('Error storing data');
        }
    };

    const serializeOctree = (octree) => {
        if (!octree) {
            console.warn('Octree is undefined');
            return null;
        }

        const serialized = {
            maxDepth: octree.maxDepth,
            blocks: [],
            entries: []
        };

        const serializeBlock = (block) => {
            if (!block) return null;

            return {
                minPoint: block.minPoint ? { x: block.minPoint.x, y: block.minPoint.y, z: block.minPoint.z } : null,
                maxPoint: block.maxPoint ? { x: block.maxPoint.x, y: block.maxPoint.y, z: block.maxPoint.z } : null,
                capacity: block.capacity,
                blocks: block.blocks ? block.blocks.map(serializeBlock).filter(Boolean) : [],
                entries: block.entries ? block.entries.map(entry => entry.id).filter(Boolean) : []
            };
        };

        if (octree.blocks && octree.blocks.length > 0) {
            serialized.blocks = octree.blocks.map(serializeBlock).filter(Boolean);
        }

        if (octree.entries && octree.entries.length > 0) {
            serialized.entries = octree.entries.map(entry => entry.id).filter(Boolean);
        }

        return serialized;
    };

    return (
        <div>
            <h2>Octree and Model Storage</h2>
            <p>Status: {storageStatus}</p>
        </div>
    );
}

export default OctreeStorage;