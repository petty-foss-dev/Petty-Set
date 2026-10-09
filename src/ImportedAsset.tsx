import { useEffect, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { SceneItem } from "./model";
import { loadAsset } from "./assetStore";

export default function ImportedAsset({ item }: { item: SceneItem }) {
  if (item.assetData) return <EmbeddedAsset item={item} />;
  return <StoredAsset item={item} />;
}

function EmbeddedAsset({ item }: { item: SceneItem }) {
  const { scene } = useLoader(GLTFLoader, item.assetData!);
  return <AssetScene item={item} scene={scene} />;
}

function StoredAsset({ item }: { item: SceneItem }) {
  const [loaded, setLoaded] = useState<{ ref: string; scene: THREE.Group }>();
  useEffect(() => {
    let active = true;
    loadAsset(item.assetRef!)
      .then((bytes) => {
        if (!bytes) throw new Error("Missing model");
        return new GLTFLoader().parseAsync(bytes, "");
      })
      .then((model) => {
        if (active) setLoaded({ ref: item.assetRef!, scene: model.scene });
      })
      .catch(() => {
        if (active) setLoaded(undefined);
      });
    return () => {
      active = false;
    };
  }, [item.assetRef]);
  if (!loaded || loaded.ref !== item.assetRef)
    return (
      <mesh position={[0, item.height / 2, 0]}>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color="#a99576" wireframe />
      </mesh>
    );
  return <AssetScene item={item} scene={loaded.scene} />;
}

function AssetScene({ item, scene }: { item: SceneItem; scene: THREE.Group }) {
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
