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
import {
  actorPoseAt,
  mannequinJointsForPose,
  snapWallPoint,
  wallEndpoints,
} from "./model";
import { actorActionPose } from "./actorActions";
import { planRooms } from "./floorplan";
import type { PlanPoint } from "./floorplan";
import SetPiece from "./SetPieces";
import Mannequin from "./Mannequin";
import type { MannequinJoints, SceneItem, SetScene, Shot } from "./model";
import { aspectRatios, cameraOptics } from "./cinematography";
import type { AspectRatio } from "./cinematography";
import { fixtureLumens, lightDirection, traceFloor } from "./lighting";

export type ViewMode = "stage" | "plan" | "camera";

function surfaceTexture(ground: "grass" | "asphalt" | "sand") {
  const palette = {
    grass: ["#7e9b6e", "#6f8c61", "#93a77c", "#a2aa80"],
    asphalt: ["#777b78", "#666c6c", "#868b87", "#9a9b91"],
    sand: ["#c7b68c", "#bba980", "#d7c69d", "#e3d4ad"],
  }[ground];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = palette[0];
  context.fillRect(0, 0, 128, 128);
  let seed = 217;
  for (let i = 0; i < 650; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 128;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 128;
    context.fillStyle = palette[1 + (seed % 3)];
    context.fillRect(x, y, 1 + (seed % 3), 1 + (seed % 2));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(70, 70);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function PlanLabel({
  text,
  x,
  z,
  color = "#342f29",
}: {
  text: string;
  x: number;
  z: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff9e8";
    context.fillRect(0, 0, 512, 96);
    context.fillStyle = color;
    context.font = "600 43px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 48);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[x, 0.17, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[Math.max(0.75, text.length * 0.115), 0.28]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} />
    </mesh>
  );
}

interface Props {
  scene: SetScene;
  shot?: Shot;
  selectedId?: string;
  mode: ViewMode;
  tool: "select" | "wall" | "room" | "corner" | "calibrate";
  poseMode: boolean;
  onSelect: (id?: string) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  onPoseJoints: (id: string, joints: MannequinJoints) => void;
  onAddWall: (
    start: { x: number; z: number },
    end: { x: number; z: number },
  ) => void;
  onAddRoom: (start: PlanPoint, end: PlanPoint) => void;
  onMoveCorner: (from: PlanPoint, to: PlanPoint) => void;
  calibrationPoints: PlanPoint[];
  onCalibrationPoint: (point: PlanPoint) => void;
  captureRef: React.MutableRefObject<(() => string) | null>;
  moveProgress: number;
  lightTraceVisible: boolean;
  lightSample: PlanPoint | null;
  onLightSample: (point: PlanPoint) => void;
}

function FixtureLight({ item, mode }: { item: SceneItem; mode: ViewMode }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const lumens = fixtureLumens(item);
  const position: [number, number, number] = [
    item.x,
    item.y + item.height,
    item.z,
  ];
  if (item.lightType === "practical")
    return (
      <pointLight
        position={position}
        color={item.color ?? "#fff4df"}
        intensity={lumens / (4 * Math.PI)}
        decay={2}
        castShadow={mode !== "plan"}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0001}
      />
    );
  const halfAngle =
    (Math.min(80, Math.max(2.5, (item.spread ?? 45) / 2)) * Math.PI) / 180;
  const direction = lightDirection(item);
  return (
    <>
      <primitive
        object={target}
        position={[
          item.x + direction.x * 4,
          position[1] + direction.y * 4,
          item.z + direction.z * 4,
        ]}
      />
      <spotLight
        position={position}
        target={target}
        color={item.color ?? "#fff4df"}
        intensity={lumens / (2 * Math.PI * (1 - Math.cos(halfAngle)))}
        angle={halfAngle}
        penumbra={item.lightType === "softbox" ? 0.4 : 0.16}
        decay={2}
        castShadow={mode !== "plan"}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
    </>
  );
}

function LightTraceOverlay({ items }: { items: SceneItem[] }) {
  const trace = useMemo(() => traceFloor(items), [items]);
  const texture = useMemo(() => {
    if (!trace) return null;
    const canvas = document.createElement("canvas");
    canvas.width = trace.width;
    canvas.height = trace.height;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(trace.width, trace.height);
    trace.values.forEach((lux, index) => {
      const strength = Math.min(1, Math.log1p(lux) / Math.log1p(500));
      const offset = index * 4;
      image.data[offset] = Math.round(70 + 185 * strength);
      image.data[offset + 1] = Math.round(155 - 75 * strength);
      image.data[offset + 2] = Math.round(210 - 170 * strength);
      image.data[offset + 3] = lux < 5 ? 0 : Math.round(45 + 155 * strength);
    });
    context.putImageData(image, 0, 0);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.minFilter = THREE.LinearFilter;
    result.magFilter = THREE.LinearFilter;
    return result;
  }, [trace]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!trace || !texture) return null;
  return (
    <mesh
      position={[
        trace.minX + trace.worldWidth / 2,
        0.029,
        trace.minZ + trace.worldHeight / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[trace.worldWidth, trace.worldHeight]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.8}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CameraRig({
  mode,
  poseTarget,
  cameraItem,
  aspectRatio,
  cameraEnd,
  cameraWaypoints,
  moveProgress,
}: {
  mode: ViewMode;
  poseTarget?: SceneItem;
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
      if (poseTarget) {
        camera.position.set(
          poseTarget.x + 1.9,
          poseTarget.y + 2.1,
          poseTarget.z + 2.8,
        );
        camera.lookAt(poseTarget.x, poseTarget.y + 0.9, poseTarget.z);
      } else {
        camera.position.set(7.5, 6.6, 8.2);
        camera.lookAt(0, 0, 0);
      }
    }
    camera.updateProjectionMatrix();
  }, [mode, poseTarget, camera]);
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
  actorJoints,
  poseMode,
  mode,
  onSelect,
  onMove,
  onPoseJoints,
}: {
  item: SceneItem;
  actorJoints?: MannequinJoints;
  poseMode: boolean;
  mode: ViewMode;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  onPoseJoints: (id: string, joints: MannequinJoints) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [draftJoints, setDraftJoints] = useState<MannequinJoints>();
  if (poseMode && item.kind === "actor") {
    return (
      <group
        position={[item.x, item.y, item.z]}
        rotation={[0, (item.rotation * Math.PI) / 180, 0]}
      >
        <Mannequin
          item={item}
          joints={draftJoints ?? actorJoints}
          poseHandles
          onPosePreview={setDraftJoints}
          onPoseCommit={(joints) => {
            onPoseJoints(item.id, joints);
            setDraftJoints(undefined);
          }}
        />
      </group>
    );
  }
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
        <SetPiece item={item} actorJoints={actorJoints} />
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
  poseMode,
  onSelect,
  onMove,
  onPoseJoints,
  onAddWall,
  onAddRoom,
  onMoveCorner,
  calibrationPoints,
  onCalibrationPoint,
  moveProgress,
  lightTraceVisible,
  lightSample,
  onLightSample,
}: Omit<Props, "captureRef">) {
  const cameraItem = scene.items.find((item) => item.id === shot?.cameraId);
  const visualItems = scene.items.map((item) => {
    if (item.kind !== "actor") return item;
    const start = shot?.actorMarks?.[item.id] ?? item;
    const path = shot?.actorPaths?.[item.id];
    return {
      ...item,
      ...(path ? actorPoseAt(start, path, moveProgress) : start),
    };
  });
  const poseTarget = poseMode
    ? visualItems.find((item) => item.id === selectedId)
    : undefined;
  const jointsAt = (item: SceneItem) => {
    if (item.kind !== "actor") return undefined;
    const base =
      shot?.actorJoints?.[item.id] ??
      item.mannequinJoints ??
      mannequinJointsForPose(item.mannequinPose);
    const action = shot?.actorActions?.[item.id];
    return action
      ? actorActionPose(base, action, moveProgress * (shot?.duration ?? 5))
      : base;
  };
  const environment = scene.environment;
  const ground = environment?.ground ?? "studio";
  const groundTexture = useMemo(
    () => (ground === "studio" ? undefined : surfaceTexture(ground)),
    [ground],
  );
  useEffect(() => () => groundTexture?.dispose(), [groundTexture]);
  const groundColors = {
    studio: "#d7d7d0",
    grass: "#7e9b6e",
    asphalt: "#777b78",
    sand: "#c7b68c",
  };
  const sunAzimuth = ((environment?.sunAzimuth ?? 35) * Math.PI) / 180;
  const sunElevation = ((environment?.sunElevation ?? 55) * Math.PI) / 180;
  const daylight =
    ground === "studio" ? 1 : Math.max(0.15, Math.sin(sunElevation));
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
  const [roomDraft, setRoomDraft] = useState<{
    start: PlanPoint;
    end: PlanPoint;
  } | null>(null);
  const [cornerDraft, setCornerDraft] = useState<{
    from: PlanPoint;
    to: PlanPoint;
  } | null>(null);
  const snap = (point: THREE.Vector3) => snapWallPoint(point, scene.items);
  const pointOnGround = (event: ThreeEvent<PointerEvent>) => {
    const point = new THREE.Vector3();
    event.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      point,
    );
    return snap(point);
  };
  const rooms = useMemo(() => planRooms(scene.items), [scene.items]);
  const corners = useMemo(() => {
    const values = scene.items
      .filter((item) => item.kind === "wall" && !item.hidden && !item.locked)
      .flatMap(wallEndpoints);
    return values.filter(
      (point, index) =>
        values.findIndex(
          (other) => Math.hypot(other.x - point.x, other.z - point.z) < 0.01,
        ) === index,
    );
  }, [scene.items]);
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
        poseTarget={poseTarget}
        cameraItem={cameraItem}
        aspectRatio={shot?.aspectRatio ?? "16:9"}
        cameraEnd={shot?.cameraEnd}
        cameraWaypoints={shot?.cameraWaypoints}
        moveProgress={moveProgress}
      />
      <ambientLight intensity={0.18 + daylight * 0.3} />
      <hemisphereLight args={["#f6f3e9", "#8d9290", 0.16 + daylight * 0.45]} />
      <directionalLight
        position={[
          Math.sin(sunAzimuth) * Math.cos(sunElevation) * 15,
          Math.sin(sunElevation) * 15,
          Math.cos(sunAzimuth) * Math.cos(sunElevation) * 15,
        ]}
        intensity={0.1 + daylight * 1.4}
        castShadow={mode !== "plan"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />
      {mode !== "plan" &&
        scene.items
          .filter((item) => item.kind === "light" && !item.hidden)
          .map((item) => (
            <FixtureLight key={item.id} item={item} mode={mode} />
          ))}
      {mode !== "plan" &&
        scene.items
          .filter((item) => item.kind === "streetlamp" && !item.hidden)
          .map((item) => (
            <pointLight
              key={`streetlamp-${item.id}`}
              position={[item.x, item.y + item.height * 0.91, item.z]}
              color="#ffd494"
              intensity={1.2}
              distance={5}
              decay={2}
            />
          ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(event) => {
          if (poseMode) return;
          if (tool === "calibrate" && mode === "plan") {
            event.stopPropagation();
            onCalibrationPoint({ x: event.point.x, z: event.point.z });
            return;
          }
          if (mode === "plan" && lightTraceVisible && tool === "select") {
            event.stopPropagation();
            onLightSample({ x: event.point.x, z: event.point.z });
            onSelect(undefined);
            return;
          }
          if ((tool === "wall" || tool === "room") && mode === "plan") {
            event.stopPropagation();
            (event.target as Element).setPointerCapture(event.pointerId);
            const start = snap(event.point);
            if (tool === "wall") setWallDraft({ start, end: start });
            else setRoomDraft({ start, end: start });
          } else onSelect(undefined);
        }}
        onPointerMove={(event) => {
          if (wallDraft) setWallDraft({ ...wallDraft, end: snap(event.point) });
          if (roomDraft) setRoomDraft({ ...roomDraft, end: snap(event.point) });
        }}
        onPointerUp={(event) => {
          if (!wallDraft && !roomDraft) return;
          (event.target as Element).releasePointerCapture(event.pointerId);
          const end = snap(event.point);
          if (
            wallDraft &&
            Math.hypot(end.x - wallDraft.start.x, end.z - wallDraft.start.z) >=
              0.25
          )
            onAddWall(wallDraft.start, end);
          if (roomDraft) onAddRoom(roomDraft.start, end);
          setWallDraft(null);
          setRoomDraft(null);
        }}
        onPointerCancel={() => {
          setWallDraft(null);
          setRoomDraft(null);
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color={groundTexture ? "#ffffff" : groundColors[ground]}
          map={groundTexture}
          roughness={1}
        />
      </mesh>
      {rooms.length > 0
        ? rooms.map((room, index) => {
            const shape = new THREE.Shape();
            room.points.forEach((point, pointIndex) => {
              if (pointIndex === 0) shape.moveTo(point.x, -point.z);
              else shape.lineTo(point.x, -point.z);
            });
            shape.closePath();
            return (
              <group key={`room-floor-${index}`}>
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, 0.008, 0]}
                  receiveShadow
                  raycast={() => null}
                >
                  <shapeGeometry args={[shape]} />
                  <meshStandardMaterial
                    color="#b6aa92"
                    roughness={0.96}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                {mode === "plan" && (
                  <PlanLabel
                    text={`Room ${index + 1} · ${room.area.toFixed(1)} m²`}
                    x={room.center.x}
                    z={room.center.z}
                  />
                )}
              </group>
            );
          })
        : roomFloor && (
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
                    position={[
                      0,
                      0.001,
                      -roomFloor.depth / 2 + (index + 1) * 0.38,
                    ]}
                    raycast={() => null}
                  >
                    <boxGeometry args={[roomFloor.width, 0.002, 0.006]} />
                    <meshBasicMaterial
                      color="#968b76"
                      transparent
                      opacity={0.4}
                    />
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
      {roomDraft && (
        <Line
          points={[
            [roomDraft.start.x, 0.12, roomDraft.start.z],
            [roomDraft.end.x, 0.12, roomDraft.start.z],
            [roomDraft.end.x, 0.12, roomDraft.end.z],
            [roomDraft.start.x, 0.12, roomDraft.end.z],
            [roomDraft.start.x, 0.12, roomDraft.start.z],
          ]}
          color="#eb8950"
          lineWidth={3}
          raycast={() => null}
        />
      )}
      {mode === "plan" &&
        tool === "corner" &&
        corners.map((point) => (
          <mesh
            key={`${point.x}-${point.z}`}
            position={[
              cornerDraft &&
              Math.hypot(
                cornerDraft.from.x - point.x,
                cornerDraft.from.z - point.z,
              ) < 0.01
                ? cornerDraft.to.x
                : point.x,
              0.2,
              cornerDraft &&
              Math.hypot(
                cornerDraft.from.x - point.x,
                cornerDraft.from.z - point.z,
              ) < 0.01
                ? cornerDraft.to.z
                : point.z,
            ]}
            onPointerDown={(event) => {
              event.stopPropagation();
              (event.target as Element).setPointerCapture(event.pointerId);
              setCornerDraft({ from: point, to: point });
            }}
            onPointerMove={(event) => {
              if (
                cornerDraft &&
                Math.hypot(
                  cornerDraft.from.x - point.x,
                  cornerDraft.from.z - point.z,
                ) < 0.01
              ) {
                event.stopPropagation();
                setCornerDraft({ ...cornerDraft, to: pointOnGround(event) });
              }
            }}
            onPointerUp={(event) => {
              if (!cornerDraft) return;
              event.stopPropagation();
              (event.target as Element).releasePointerCapture(event.pointerId);
              onMoveCorner(cornerDraft.from, pointOnGround(event));
              setCornerDraft(null);
            }}
            onPointerCancel={() => setCornerDraft(null)}
          >
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshBasicMaterial color="#ee8f46" depthTest={false} />
          </mesh>
        ))}
      {mode === "plan" &&
        scene.items
          .filter((item) => item.kind === "wall" && !item.hidden)
          .map((wall) => (
            <PlanLabel
              key={`length-${wall.id}`}
              text={`${wall.width.toFixed(2)} m`}
              x={wall.x}
              z={wall.z}
            />
          ))}
      {mode === "plan" &&
        calibrationPoints.map((point, index) => (
          <mesh
            key={index}
            position={[point.x, 0.19, point.z]}
            raycast={() => null}
          >
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshBasicMaterial color="#e76b36" depthTest={false} />
          </mesh>
        ))}
      {mode === "plan" && calibrationPoints.length === 2 && (
        <Line
          points={calibrationPoints.map((point) => [point.x, 0.18, point.z])}
          color="#e76b36"
          lineWidth={3}
          raycast={() => null}
        />
      )}
      {floorTexture && (
        <group
          position={[floorplanPlacement.x, 0.012, floorplanPlacement.z]}
          rotation={[0, (floorplanPlacement.rotation * Math.PI) / 180, 0]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
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
      {mode === "plan" && lightTraceVisible && (
        <LightTraceOverlay items={scene.items} />
      )}
      {mode === "plan" && lightTraceVisible && lightSample && (
        <group position={[lightSample.x, 0.045, lightSample.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.11, 0.16, 24]} />
            <meshBasicMaterial color="#352414" depthTest={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[0.035, 20]} />
            <meshBasicMaterial color="#fff8e9" depthTest={false} />
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
      {mode !== "camera" &&
        scene.items
          .filter(
            (item) =>
              item.kind === "light" && item.powerSourceId && !item.hidden,
          )
          .map((light) => {
            const source = scene.items.find(
              (item) => item.id === light.powerSourceId && !item.hidden,
            );
            if (!source) return null;
            return (
              <Line
                key={`cable-${light.id}`}
                points={[
                  [source.x, 0.065, source.z],
                  [light.x, 0.065, light.z],
                ]}
                color="#e28a38"
                lineWidth={2}
                raycast={() => null}
              />
            );
          })}
      {visualItems
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
              key={`${shot?.id ?? "scene"}-${item.id}`}
              item={item}
              actorJoints={jointsAt(item)}
              poseMode={poseMode}
              mode={mode}
              onSelect={onSelect}
              onMove={onMove}
              onPoseJoints={onPoseJoints}
            />
          ) : (
            <group
              key={item.id}
              position={[item.x, item.y, item.z]}
              rotation={[0, (item.rotation * Math.PI) / 180, 0]}
              onPointerDown={(event) => {
                if (tool === "select" && !poseMode) select(event, item.id);
              }}
            >
              <SetPiece
                item={item}
                actorJoints={jointsAt(item)}
                walkPhase={
                  shot?.actorPaths?.[item.id]
                    ? moveProgress * Math.PI * 6
                    : undefined
                }
              />
            </group>
          ),
        )}
      {mode !== "camera" &&
        Object.entries(shot?.actorPaths ?? {}).map(([actorId, path]) => {
          const actor = scene.items.find((item) => item.id === actorId);
          if (!actor || actor.hidden) return null;
          const start = shot?.actorMarks?.[actorId] ?? actor;
          return (
            <group key={`actor-path-${actorId}`}>
              <Line
                points={[start, ...path.waypoints, path.end].map(
                  (point) =>
                    [point.x, 0.075, point.z] as [number, number, number],
                )}
                color="#4b9e97"
                lineWidth={2}
                raycast={() => null}
              />
              {[...path.waypoints, path.end].map((point, index) => (
                <mesh
                  key={index}
                  position={[point.x, 0.085, point.z]}
                  raycast={() => null}
                >
                  <sphereGeometry args={[0.08, 12, 8]} />
                  <meshBasicMaterial color="#4b9e97" />
                </mesh>
              ))}
            </group>
          );
        })}
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
          enabled={tool === "select"}
          enableRotate={mode !== "plan" && !poseMode}
          enablePan={!poseMode}
          target={
            poseTarget
              ? [poseTarget.x, poseTarget.y + 0.9, poseTarget.z]
              : [0, 0, 0]
          }
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
      <color
        attach="background"
        args={[props.scene.environment?.skyColor ?? "#dce0de"]}
      />
      <StageContent {...content} />
    </Canvas>
  );
}
