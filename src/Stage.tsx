import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Grid,
  Line,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import { snapWallPoint, wallEndpoints } from "./model";
import SetPiece from "./SetPieces";
import type { SceneItem, SetScene, Shot } from "./model";
import { aspectRatios, cameraOptics } from "./cinematography";
import type { AspectRatio } from "./cinematography";

export type ViewMode = "stage" | "plan" | "camera";

interface Props {
  scene: SetScene;
  shot?: Shot;
  selectedId?: string;
  mode: ViewMode;
  tool: "select" | "wall";
  onSelect: (id?: string) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  onAddWall: (
    start: { x: number; z: number },
    end: { x: number; z: number },
  ) => void;
  captureRef: React.MutableRefObject<(() => string) | null>;
  moveProgress: number;
}

function CameraRig({
  mode,
  cameraItem,
  aspectRatio,
  cameraEnd,
  cameraWaypoints,
  moveProgress,
}: {
  mode: ViewMode;
  cameraItem?: SceneItem;
  aspectRatio: AspectRatio;
  cameraEnd?: Shot["cameraEnd"];
  cameraWaypoints?: Shot["cameraWaypoints"];
  moveProgress: number;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (mode === "plan") {
      camera.position.set(0, 20, 0.01);
      camera.lookAt(0, 0, 0);
    } else if (mode === "stage") {
      camera.position.set(7.5, 6.6, 8.2);
      camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
  }, [mode, camera]);
  if (!cameraItem || mode !== "camera") return null;
  const gateFov = cameraOptics(
    cameraItem.sensor ?? "super35",
    cameraItem.focalLength ?? 35,
    cameraItem.aperture ?? 2.8,
    cameraItem.focusDistance ?? 3,
    aspectRatio,
  ).verticalFov;
  const frameHeight = Math.min(
    size.height * 0.9,
    (size.width * 0.9) / aspectRatios[aspectRatio],
  );
  const fov =
    (2 *
      Math.atan(
        Math.tan((gateFov * Math.PI) / 360) * (size.height / frameHeight),
      ) *
      180) /
    Math.PI;
  const poses = [
    cameraItem,
    ...(cameraWaypoints ?? []),
    cameraEnd ?? cameraItem,
  ];
  const travel = Math.min(poses.length - 1, moveProgress * (poses.length - 1));
  const segment = Math.min(poses.length - 2, Math.floor(travel));
  const fraction = travel - segment;
  const from = poses[segment],
    to = poses[segment + 1];
  const x = THREE.MathUtils.lerp(from.x, to.x, fraction);
  const z = THREE.MathUtils.lerp(from.z, to.z, fraction);
  const height = THREE.MathUtils.lerp(from.height, to.height, fraction);
  const delta =
    THREE.MathUtils.euclideanModulo(to.rotation - from.rotation + 180, 360) -
    180;
  const yaw = ((from.rotation + delta * fraction) * Math.PI) / 180;
  return (
    <PerspectiveCamera
      makeDefault
      position={[x, height, z]}
      rotation={[0, yaw, 0]}
      fov={fov}
      near={0.05}
      far={500}
    />
  );
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
        <SetPiece item={item} />
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
  tool,
  onSelect,
  onMove,
  onAddWall,
  moveProgress,
}: Omit<Props, "captureRef">) {
  const cameraItem = scene.items.find((item) => item.id === shot?.cameraId);
  const floorTexture = useMemo(() => {
    if (!scene.floorplan) return undefined;
    const texture = new THREE.TextureLoader().load(scene.floorplan);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [scene.floorplan]);
  const [wallDraft, setWallDraft] = useState<{
    start: { x: number; z: number };
    end: { x: number; z: number };
  } | null>(null);
  const snap = (point: THREE.Vector3) => snapWallPoint(point, scene.items);
  const floorplanPlacement = scene.floorplanPlacement ?? {
    x: 0,
    z: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 0.65,
  };
  const roomFloor = useMemo(() => {
    const points = scene.items
      .filter((item) => item.kind === "wall")
      .flatMap(wallEndpoints);
    if (points.length < 4) return null;
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    return {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      width: maxX - minX,
      depth: maxZ - minZ,
    };
  }, [scene.items]);

  const select = (event: ThreeEvent<PointerEvent>, id: string) => {
    event.stopPropagation();
    onSelect(id);
  };
  return (
    <>
      <CameraRig
        mode={mode}
        cameraItem={cameraItem}
        aspectRatio={shot?.aspectRatio ?? "16:9"}
        cameraEnd={shot?.cameraEnd}
        cameraWaypoints={shot?.cameraWaypoints}
        moveProgress={moveProgress}
      />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#f6f3e9", "#8d9290", 1.3]} />
      <directionalLight
        position={[5, 10, 6]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {scene.items
        .filter((item) => item.kind === "light" && !item.hidden)
        .map((item) =>
          item.lightType === "practical" ? (
            <pointLight
              key={`light-${item.id}`}
              position={[item.x, item.height, item.z]}
              color={item.color ?? "#fff4df"}
              intensity={item.intensity ?? 2}
              distance={6}
              decay={2}
            />
          ) : (
            <spotLight
              key={`light-${item.id}`}
              position={[item.x, item.height, item.z]}
              target-position={[
                item.x - Math.sin((item.rotation * Math.PI) / 180) * 2,
                1,
                item.z - Math.cos((item.rotation * Math.PI) / 180) * 2,
              ]}
              color={item.color ?? "#fff4df"}
              intensity={item.intensity ?? 2}
              angle={
                ((item.spread ?? (item.lightType === "spot" ? 30 : 75)) *
                  Math.PI) /
                360
              }
              distance={8}
            />
          ),
        )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(event) => {
          if (tool === "wall" && mode === "plan") {
            event.stopPropagation();
            (event.target as Element).setPointerCapture(event.pointerId);
            const start = snap(event.point);
            setWallDraft({ start, end: start });
          } else onSelect(undefined);
        }}
        onPointerMove={(event) => {
          if (wallDraft) setWallDraft({ ...wallDraft, end: snap(event.point) });
        }}
        onPointerUp={(event) => {
          if (!wallDraft) return;
          (event.target as Element).releasePointerCapture(event.pointerId);
          const end = snap(event.point);
          if (
            Math.hypot(end.x - wallDraft.start.x, end.z - wallDraft.start.z) >=
            0.25
          )
            onAddWall(wallDraft.start, end);
          setWallDraft(null);
        }}
        onPointerCancel={() => setWallDraft(null)}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#d7d7d0" roughness={1} />
      </mesh>
      {roomFloor && (
        <group position={[roomFloor.x, 0.006, roomFloor.z]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            raycast={() => null}
          >
            <planeGeometry args={[roomFloor.width, roomFloor.depth]} />
            <meshStandardMaterial color="#b6aa92" roughness={0.96} />
          </mesh>
          {Array.from(
            { length: Math.floor(roomFloor.depth / 0.38) },
            (_, index) => (
              <mesh
                key={index}
                position={[0, 0.001, -roomFloor.depth / 2 + (index + 1) * 0.38]}
                raycast={() => null}
              >
                <boxGeometry args={[roomFloor.width, 0.002, 0.006]} />
                <meshBasicMaterial color="#968b76" transparent opacity={0.4} />
              </mesh>
            ),
          )}
        </group>
      )}
      {wallDraft && (
        <mesh
          position={[
            (wallDraft.start.x + wallDraft.end.x) / 2,
            1.4,
            (wallDraft.start.z + wallDraft.end.z) / 2,
          ]}
          rotation={[
            0,
            Math.atan2(
              wallDraft.start.z - wallDraft.end.z,
              wallDraft.end.x - wallDraft.start.x,
            ),
            0,
          ]}
        >
          <boxGeometry
            args={[
              Math.max(
                0.02,
                Math.hypot(
                  wallDraft.end.x - wallDraft.start.x,
                  wallDraft.end.z - wallDraft.start.z,
                ),
              ),
              2.8,
              0.12,
            ]}
          />
          <meshBasicMaterial color="#eb8950" transparent opacity={0.5} />
        </mesh>
      )}
      {floorTexture && (
        <group
          position={[floorplanPlacement.x, 0.012, floorplanPlacement.z]}
          rotation={[0, (floorplanPlacement.rotation * Math.PI) / 180, 0]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry
              args={[floorplanPlacement.width, floorplanPlacement.height]}
            />
            <meshBasicMaterial
              map={floorTexture}
              transparent
              opacity={floorplanPlacement.opacity}
            />
          </mesh>
        </group>
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
        .filter(
          (item) =>
            !item.hidden && (mode !== "camera" || item.id !== cameraItem?.id),
        )
        .map((item) =>
          item.id === selectedId &&
          mode !== "camera" &&
          (tool === "select" || mode !== "plan") &&
          !item.locked ? (
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
              onPointerDown={(event) => {
                if (tool !== "wall") select(event, item.id);
              }}
            >
              <SetPiece item={item} />
            </group>
          ),
        )}
      {mode !== "camera" && cameraItem && shot?.cameraEnd && (
        <group>
          <Line
            points={[
              cameraItem,
              ...(shot.cameraWaypoints ?? []),
              shot.cameraEnd,
            ].map(
              (point) => [point.x, 0.055, point.z] as [number, number, number],
            )}
            color="#df7540"
            lineWidth={2}
            raycast={() => null}
          />
          {[...(shot.cameraWaypoints ?? []), shot.cameraEnd].map(
            (point, index) => (
              <mesh
                key={index}
                position={[point.x, 0.065, point.z]}
                raycast={() => null}
              >
                <sphereGeometry args={[0.09, 12, 8]} />
                <meshBasicMaterial
                  color={
                    index === (shot.cameraWaypoints?.length ?? 0)
                      ? "#faad6a"
                      : "#df7540"
                  }
                />
              </mesh>
            ),
          )}
        </group>
      )}
      {mode !== "camera" && (
        <OrbitControls
          enabled={tool !== "wall"}
          enableRotate={mode !== "plan"}
          maxPolarAngle={Math.PI / 2.02}
          minDistance={2}
          maxDistance={60}
          makeDefault
        />
      )}
    </>
  );
}

export default function Stage(props: Props) {
  const { captureRef, ...content } = props;
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [7.5, 6.6, 8.2], fov: 50 }}
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
