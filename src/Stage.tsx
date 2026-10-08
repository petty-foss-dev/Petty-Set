import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Grid,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import type { SceneItem, SetScene, Shot } from "./model";

export type ViewMode = "stage" | "plan" | "camera";

interface Props {
  scene: SetScene;
  shot?: Shot;
  selectedId?: string;
  mode: ViewMode;
  onSelect: (id?: string) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  captureRef: React.MutableRefObject<(() => string) | null>;
}

function CameraRig({
  mode,
  cameraItem,
}: {
  mode: ViewMode;
  cameraItem?: SceneItem;
}) {
  const { camera } = useThree();
  useEffect(() => {
    if (mode === "plan") {
      camera.position.set(0, 20, 0.01);
      camera.lookAt(0, 0, 0);
    } else if (mode === "stage") {
      camera.position.set(8, 7, 9);
      camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
  }, [mode, camera]);
  if (!cameraItem || mode !== "camera") return null;
  const fov =
    (2 * Math.atan(24 / (2 * (cameraItem.focalLength ?? 35))) * 180) / Math.PI;
  const yaw = (cameraItem.rotation * Math.PI) / 180;
  return (
    <PerspectiveCamera
      makeDefault
      position={[cameraItem.x, cameraItem.height, cameraItem.z]}
      rotation={[0, yaw, 0]}
      fov={fov}
      near={0.05}
      far={500}
    />
  );
}

function Actor({ item }: { item: SceneItem }) {
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    time.current += delta;
    if (group.current)
      group.current.rotation.z =
        Math.sin(time.current * 1.8 + item.x) * 0.012;
  });
  return (
    <group ref={group}>
      <mesh position={[0, 1.37, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshStandardMaterial color="#c99872" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.83, 0]} castShadow>
        <capsuleGeometry args={[0.27, 0.55, 6, 12]} />
        <meshStandardMaterial color="#cc8451" roughness={0.85} />
      </mesh>
      <mesh position={[-0.14, 0.29, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
        <meshStandardMaterial color="#28313b" />
      </mesh>
      <mesh position={[0.14, 0.29, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
        <meshStandardMaterial color="#28313b" />
      </mesh>
    </group>
  );
}

function ItemMesh({ item }: { item: SceneItem }) {
  const material = (color: string) => (
    <meshStandardMaterial color={color} roughness={0.72} />
  );
  switch (item.kind) {
    case "wall":
      return (
        <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          {material("#aeb4b5")}
        </mesh>
      );
    case "box":
      return (
        <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          {material("#b3a38c")}
        </mesh>
      );
    case "actor":
      return <Actor item={item} />;
    case "table":
      return (
        <group>
          <mesh position={[0, item.height - 0.08, 0]} castShadow>
            <boxGeometry args={[item.width, 0.16, item.depth]} />
            {material("#8d6246")}
          </mesh>
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh
                key={`${x}-${z}`}
                position={[
                  x * (item.width / 2 - 0.12),
                  item.height / 2 - 0.08,
                  z * (item.depth / 2 - 0.12),
                ]}
                castShadow
              >
                <boxGeometry args={[0.12, item.height - 0.16, 0.12]} />
                {material("#76523d")}
              </mesh>
            )),
          )}
        </group>
      );
    case "chair":
      return (
        <group>
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[item.width, 0.1, item.depth]} />
            {material("#7a6555")}
          </mesh>
          <mesh position={[0, 0.67, -item.depth / 2 + 0.05]} castShadow>
            <boxGeometry args={[item.width, 0.5, 0.1]} />
            {material("#7a6555")}
          </mesh>
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh
                key={`${x}-${z}`}
                position={[x * 0.21, 0.22, z * 0.2]}
                castShadow
              >
                <boxGeometry args={[0.07, 0.44, 0.07]} />
                {material("#584a40")}
              </mesh>
            )),
          )}
        </group>
      );
    case "camera":
      return (
        <group>
          <mesh position={[0, item.height, 0]} castShadow>
            <boxGeometry args={[0.42, 0.28, 0.36]} />
            {material("#292e32")}
          </mesh>
          <mesh
            position={[0, item.height, -0.31]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.11, 0.15, 0.32, 20]} />
            {material("#202529")}
          </mesh>
          <mesh position={[0, item.height / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.04, item.height - 0.25, 8]} />
            {material("#343b41")}
          </mesh>
        </group>
      );
    case "light":
      return (
        <group>
          <mesh position={[0, item.height / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.04, item.height, 8]} />
            {material("#444b52")}
          </mesh>
          <mesh position={[0, item.height, 0]} castShadow>
            <boxGeometry args={[0.42, 0.3, 0.18]} />
            {material("#32373b")}
          </mesh>
          <mesh position={[0, item.height, -0.11]}>
            <planeGeometry args={[0.32, 0.2]} />
            <meshBasicMaterial color={item.color ?? "#fff2d7"} />
          </mesh>
        </group>
      );
  }
}

function SelectedObject({
  item,
  mode,
  onSelect,
  onMove,
}: {
  item: SceneItem;
  mode: ViewMode;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  return (
    <TransformControls
      mode="translate"
      showY={mode !== "plan"}
      onMouseUp={() => {
        const position = group.current?.position;
        if (position) onMove(item.id, position.x, position.y, position.z);
      }}
    >
      <group
        ref={group}
        position={[item.x, item.y, item.z]}
        rotation={[0, (item.rotation * Math.PI) / 180, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(item.id);
        }}
      >
        <ItemMesh item={item} />
        <mesh position={[0, Math.max(0.3, item.height / 2), 0]}>
          <boxGeometry
            args={[
              Math.max(0.4, item.width + 0.12),
              Math.max(0.5, item.height + 0.12),
              Math.max(0.4, item.depth + 0.12),
            ]}
          />
          <meshBasicMaterial
            color="#f59b42"
            wireframe
            transparent
            opacity={0.7}
            depthTest={false}
          />
        </mesh>
      </group>
    </TransformControls>
  );
}

function StageContent({
  scene,
  shot,
  selectedId,
  mode,
  onSelect,
  onMove,
}: Omit<Props, "captureRef">) {
  const cameraItem = scene.items.find((item) => item.id === shot?.cameraId);
  const floorTexture = useMemo(() => {
    if (!scene.floorplan) return undefined;
    const texture = new THREE.TextureLoader().load(scene.floorplan);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [scene.floorplan]);

  const select = (event: ThreeEvent<PointerEvent>, id: string) => {
    event.stopPropagation();
    onSelect(id);
  };
  return (
    <>
      <CameraRig mode={mode} cameraItem={cameraItem} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#f6f3e9", "#8d9290", 1.3]} />
      <directionalLight
        position={[5, 10, 6]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {scene.items
        .filter((item) => item.kind === "light")
        .map((item) => (
          <spotLight
            key={`light-${item.id}`}
            position={[item.x, item.height, item.z]}
            target-position={[item.x, 0, item.z - 1]}
            color={item.color ?? "#fff4df"}
            intensity={item.intensity ?? 2}
            angle={((item.spread ?? 45) * Math.PI) / 360}
            distance={8}
          />
        ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={() => onSelect(undefined)}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#d7d7d0" roughness={1} />
      </mesh>
      {floorTexture && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshBasicMaterial map={floorTexture} transparent opacity={0.65} />
        </mesh>
      )}
      {mode !== "camera" && (
        <Grid
          position={[0, 0.015, 0]}
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.45}
          cellColor="#9fa7a5"
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor="#77817e"
          fadeDistance={45}
          infiniteGrid
        />
      )}
      {scene.items
        .filter((item) => mode !== "camera" || item.id !== cameraItem?.id)
        .map((item) =>
          item.id === selectedId && mode !== "camera" ? (
            <SelectedObject
              key={item.id}
              item={item}
              mode={mode}
              onSelect={onSelect}
              onMove={onMove}
            />
          ) : (
            <group
              key={item.id}
              position={[item.x, item.y, item.z]}
              rotation={[0, (item.rotation * Math.PI) / 180, 0]}
              onPointerDown={(event) => select(event, item.id)}
            >
              <ItemMesh item={item} />
            </group>
          ),
        )}
      <OrbitControls
        enabled={mode !== "camera"}
        enableRotate={mode !== "plan"}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={2}
        maxDistance={60}
        makeDefault
      />
    </>
  );
}

export default function Stage(props: Props) {
  const { captureRef, ...content } = props;
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [8, 7, 9], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        captureRef.current = () => gl.domElement.toDataURL("image/png");
      }}
    >
      <color attach="background" args={["#dce0de"]} />
      <StageContent {...content} />
    </Canvas>
  );
}
