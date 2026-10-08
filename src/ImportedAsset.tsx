import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { SceneItem } from "./model";

export default function ImportedAsset({ item }: { item: SceneItem }) {
  const { scene } = useLoader(GLTFLoader, item.assetData!);
  const { clone, bounds } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return { clone, bounds: new THREE.Box3().setFromObject(clone) };
  }, [scene]);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  return (
    <group
      scale={[
        item.width / Math.max(size.x, 0.01),
        item.height / Math.max(size.y, 0.01),
        item.depth / Math.max(size.z, 0.01),
      ]}
    >
      <primitive
        object={clone}
        position={[-center.x, -bounds.min.y, -center.z]}
      />
    </group>
  );
}
