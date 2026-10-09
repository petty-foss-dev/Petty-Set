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
  keyedPoseAt,
  cameraPoseAt,
  mannequinJointsForPose,
  snapWallPoint,
  wallEndpoints,
} from "./model";
import { actorActionPose } from "./actorActions";
import type { CameraRouteCollision } from "./cameraRoute";
import { planRooms, roomFinishFor } from "./floorplan";
import type { PlanPoint } from "./floorplan";
import SetPiece from "./SetPieces";
import Mannequin from "./Mannequin";
import type {
  ActorMark,
  ActorPath,
  FloorFinish,
  MannequinJoints,
  SceneItem,
  SetScene,
  Shot,
} from "./model";
import { aspectRatios, cameraOptics } from "./cinematography";
import type { AspectRatio } from "./cinematography";
import { fixtureLumens, lightDirection, traceFloor } from "./lighting";

export type ViewMode = "stage" | "plan" | "camera";
export interface CaptureOptions {
  width: number;
  height: number;
  fov: number;
}

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

function roomTexture(finish: FloorFinish): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const base = {
    timber: "#c5a67d",
    tile: "#d4d6cf",
    concrete: "#aeb2ad",
    stone: "#bdb29e",
  }[finish];
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  if (finish === "timber") {
    for (let row = 0; row < 8; row++) {
      const top = row * 32;
      context.fillStyle =
        row % 3 === 0 ? "#cbae87" : row % 3 === 1 ? "#bea078" : "#c7a982";
      context.fillRect(0, top + 2, 256, 29);
      context.fillStyle = "#806a50";
      context.fillRect(0, top, 256, 2);
      context.fillRect(row % 2 ? 64 : 192, top, 2, 32);
      context.strokeStyle = "#a98a64";
      context.lineWidth = 1;
      for (let line = 0; line < 4; line++) {
        context.beginPath();
        context.moveTo(0, top + 7 + line * 5);
        context.bezierCurveTo(
          70,
          top + 5 + line * 5,
          180,
          top + 9 + line * 5,
          256,
          top + 7 + line * 5,
        );
        context.stroke();
      }
    }
  } else if (finish === "tile") {
    context.fillStyle = "#a7aaa5";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 4; column++) {
        context.fillStyle = (row + column) % 3 === 0 ? "#e1e0d8" : "#d1d5d0";
        context.fillRect(column * 64 + 3, row * 64 + 3, 58, 58);
      }
  } else if (finish === "stone") {
    context.fillStyle = "#8d8478";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++)
      for (let column = -1; column < 4; column++) {
        context.fillStyle = (row + column) % 3 === 0 ? "#c7bca7" : "#b8ad99";
        context.fillRect(
          column * 80 + (row % 2) * 40 + 3,
          row * 64 + 3,
          74,
          58,
        );
      }
  } else {
    context.strokeStyle = "#919792";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(128, 0);
    context.lineTo(128, 256);
    context.moveTo(0, 128);
    context.lineTo(256, 128);
    context.stroke();
  }
  let seed = 121;
  for (let index = 0; index < 900; index++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 256;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 256;
    context.fillStyle = index % 2 ? "#ffffff18" : "#352c2810";
    context.fillRect(x, y, 1 + (seed % 2), 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function PlanLabel({
  text,
  x,
  z,
  color = "#342f29",
  large = false,
}: {
  text: string;
  x: number;
  z: number;
  color?: string;
  large?: boolean;
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
      <planeGeometry
        args={[
          Math.max(large ? 1.05 : 0.75, text.length * (large ? 0.155 : 0.115)),
          large ? 0.4 : 0.28,
        ]}
      />
      <meshBasicMaterial map={texture} transparent depthTest={false} />
    </mesh>
  );
}

function PlanDimensions({ item }: { item: SceneItem }) {
  const x = item.width / 2;
  const z = item.depth / 2;
  const offset = 0.28;
  return (
    <group
      position={[item.x, 0, item.z]}
      rotation={[0, (item.rotation * Math.PI) / 180, 0]}
    >
      <Line
        points={[
          [-x, 0.19, z + offset],
          [x, 0.19, z + offset],
        ]}
        color="#bb642f"
        lineWidth={2}
        raycast={() => null}
      />
      <Line
        points={[
          [x + offset, 0.19, -z],
          [x + offset, 0.19, z],
        ]}
        color="#bb642f"
        lineWidth={2}
        raycast={() => null}
      />
      {[-x, x].map((end) => (
        <Line
          key={`width-${end}`}
          points={[
            [end, 0.19, z + offset - 0.08],
            [end, 0.19, z + offset + 0.08],
          ]}
          color="#bb642f"
          lineWidth={2}
          raycast={() => null}
        />
      ))}
      {[-z, z].map((end) => (
        <Line
          key={`depth-${end}`}
          points={[
            [x + offset - 0.08, 0.19, end],
            [x + offset + 0.08, 0.19, end],
          ]}
          color="#bb642f"
          lineWidth={2}
          raycast={() => null}
        />
      ))}
      <PlanLabel
        text={`${item.width.toFixed(2)} m`}
        x={0}
        z={z + offset + 0.26}
        color="#71391c"
        large
      />
      <PlanLabel
        text={`${item.depth.toFixed(2)} m`}
        x={x + offset + 0.65}
        z={0}
        color="#71391c"
        large
      />
    </group>
  );
}

interface Props {
  scene: SetScene;
  shot?: Shot;
  routeCollisions: CameraRouteCollision[];
  actorCollisions: CameraRouteCollision[];
  selectedId?: string;
  selectedIds: string[];
  mode: ViewMode;
  transformMode: "translate" | "rotate";
  tool: "select" | "wall" | "room" | "polygon" | "corner" | "calibrate";
  poseMode: boolean;
  onSelect: (id?: string, extend?: boolean) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  onRotate: (id: string, rotation: number) => void;
  onMoveActorPathPoint: (
    id: string,
    index: number,
    point: { x: number; z: number },
  ) => void;
  onMoveCameraPathPoint: (
    index: number,
    point: { x: number; z: number },
  ) => void;
  onPoseJoints: (id: string, joints: MannequinJoints) => void;
  onAddWall: (
    start: { x: number; z: number },
    end: { x: number; z: number },
  ) => void;
  onAddRoom: (start: PlanPoint, end: PlanPoint) => void;
  onAddPolygonRoom: (points: PlanPoint[]) => void;
  onMoveCorner: (from: PlanPoint, to: PlanPoint) => void;
  calibrationPoints: PlanPoint[];
  onCalibrationPoint: (point: PlanPoint) => void;
  captureRef: React.MutableRefObject<
    ((options?: CaptureOptions) => string) | null
  >;
  moveProgress: number;
  lightTraceVisible: boolean;
  lightRaySamples: number;
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

function LightTraceOverlay({
  items,
  samples,
}: {
  items: SceneItem[];
  samples: number;
}) {
  const trace = useMemo(
    () => traceFloor(items, 0.25, samples),
    [items, samples],
  );
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
  targetActor,
  aspectRatio,
  shot,
  moveProgress,
}: {
  mode: ViewMode;
  poseTarget?: SceneItem;
  cameraItem?: SceneItem;
  targetActor?: SceneItem;
  aspectRatio: AspectRatio;
  shot?: Shot;
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
  const pose = cameraPoseAt(cameraItem, shot ?? {}, moveProgress);
  const position = new THREE.Vector3(pose.x, pose.height, pose.z);
  const orientation = targetActor
    ? new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(
          position,
          new THREE.Vector3(
            targetActor.x,
            targetActor.y + targetActor.height * 0.7,
            targetActor.z,
          ),
          new THREE.Vector3(0, 1, 0),
        ),
      )
    : new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, (pose.rotation * Math.PI) / 180, 0),
      );
  return (
    <PerspectiveCamera
      makeDefault
      position={[pose.x, pose.height, pose.z]}
      quaternion={orientation}
      fov={fov}
      near={0.05}
      far={500}
    />
  );
}

function SelectedObject({
  item,
  actorJoints,
  walkPhase,
  poseMode,
  mode,
  transformMode,
  onSelect,
  onMove,
  onRotate,
  onPoseJoints,
}: {
  item: SceneItem;
  actorJoints?: MannequinJoints;
  walkPhase?: number;
  poseMode: boolean;
  mode: ViewMode;
  transformMode: "translate" | "rotate";
  onSelect: (id: string, extend?: boolean) => void;
  onMove: (id: string, x: number, y: number, z: number) => void;
  onRotate: (id: string, rotation: number) => void;
  onPoseJoints: (id: string, joints: MannequinJoints) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [draftJoints, setDraftJoints] = useState<MannequinJoints>();
  const [draftRotation, setDraftRotation] = useState<number>();
  const rotationStart = useRef<
    { x: number; y: number; moved: boolean } | undefined
  >(undefined);
  const handleRadius = Math.max(item.width, item.depth) * 0.6 + 0.5;
  const angleAt = (event: ThreeEvent<PointerEvent>) => {
    const point = new THREE.Vector3();
    if (
      !event.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        point,
      )
    )
      return item.rotation;
    return (
      (THREE.MathUtils.radToDeg(
        Math.atan2(item.z - point.z, point.x - item.x),
      ) +
        360) %
      360
    );
  };
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
  const body = (
    <group
      ref={group}
      position={[item.x, item.y, item.z]}
      rotation={[0, ((draftRotation ?? item.rotation) * Math.PI) / 180, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(item.id, event.nativeEvent.shiftKey);
      }}
    >
      <SetPiece item={item} actorJoints={actorJoints} walkPhase={walkPhase} />
      <mesh
        position={[0, Math.max(0.3, item.height / 2), 0]}
        raycast={() => null}
      >
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
      {transformMode === "rotate" && mode === "plan" && (
        <group>
          <Line
            points={[
              [0, 0.18, 0],
              [handleRadius, 0.18, 0],
            ]}
            color="#d66f32"
            lineWidth={2}
            raycast={() => null}
          />
          <mesh
            position={[handleRadius, 0.18, 0]}
            onPointerDown={(event) => {
              event.stopPropagation();
              (event.target as Element).setPointerCapture(event.pointerId);
              rotationStart.current = {
                x: event.clientX,
                y: event.clientY,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              if (!rotationStart.current) return;
              event.stopPropagation();
              if (
                Math.hypot(
                  event.clientX - rotationStart.current.x,
                  event.clientY - rotationStart.current.y,
                ) > 4
              ) {
                rotationStart.current.moved = true;
                setDraftRotation(angleAt(event));
              }
            }}
            onPointerUp={(event) => {
              if (!rotationStart.current) return;
              event.stopPropagation();
              (event.target as Element).releasePointerCapture(event.pointerId);
              if (rotationStart.current.moved)
                onRotate(item.id, Number(angleAt(event).toFixed(1)));
              rotationStart.current = undefined;
              setDraftRotation(undefined);
            }}
            onPointerCancel={() => {
              rotationStart.current = undefined;
              setDraftRotation(undefined);
            }}
          >
            <sphereGeometry args={[0.19, 16, 12]} />
            <meshBasicMaterial color="#e47e39" depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
  if (transformMode === "rotate" && mode === "plan") return body;
  return (
    <TransformControls
      mode={transformMode}
      showX={transformMode === "translate"}
      showY={transformMode === "rotate" || mode !== "plan"}
      showZ={transformMode === "translate"}
      onMouseUp={() => {
        const object = group.current;
        if (!object) return;
        if (transformMode === "rotate") {
          const rotation =
            ((THREE.MathUtils.radToDeg(object.rotation.y) % 360) + 360) % 360;
          if (Math.abs(rotation - item.rotation) > 0.05)
            onRotate(item.id, Number(rotation.toFixed(1)));
        } else if (
          object.position.distanceTo(
            new THREE.Vector3(item.x, item.y, item.z),
          ) > 0.001
        ) {
          onMove(
            item.id,
            object.position.x,
            object.position.y,
            object.position.z,
          );
        }
      }}
    >
      {body}
    </TransformControls>
  );
}

function ActorRoute({
  actor,
  start,
  path,
  editable,
  items,
  onMovePoint,
  onDragChange,
}: {
  actor: SceneItem;
  start: ActorMark;
  path: ActorPath;
  editable: boolean;
  items: SceneItem[];
  onMovePoint: (index: number, point: { x: number; z: number }) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const [drag, setDrag] = useState<{
    index: number;
    point: { x: number; z: number };
  } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const points = [...path.waypoints, path.end].map((point, index) =>
    drag?.index === index ? { ...point, ...drag.point } : point,
  );
  const groundPoint = (event: ThreeEvent<PointerEvent>) => {
    const intersection = new THREE.Vector3();
    event.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      intersection,
    );
    return snapWallPoint(intersection, items);
  };
  return (
    <group>
      <Line
        points={[start, ...points].map(
          (point) => [point.x, 0.075, point.z] as [number, number, number],
        )}
        color="#4b9e97"
        lineWidth={2}
        raycast={() => null}
      />
      {points.map((point, index) => {
        const isEnd = index === path.waypoints.length;
        return (
          <group key={index}>
            <mesh
              position={[point.x, editable ? 0.16 : 0.085, point.z]}
              onPointerDown={
                editable
                  ? (event) => {
                      event.stopPropagation();
                      (event.target as Element).setPointerCapture(
                        event.pointerId,
                      );
                      setDrag({ index, point: { x: point.x, z: point.z } });
                      dragStart.current = {
                        x: event.clientX,
                        y: event.clientY,
                      };
                      dragMoved.current = false;
                      onDragChange(true);
                    }
                  : undefined
              }
              onPointerMove={
                editable
                  ? (event) => {
                      if (drag?.index !== index) return;
                      event.stopPropagation();
                      if (
                        dragStart.current &&
                        Math.hypot(
                          event.clientX - dragStart.current.x,
                          event.clientY - dragStart.current.y,
                        ) > 4
                      )
                        dragMoved.current = true;
                      if (dragMoved.current)
                        setDrag({ index, point: groundPoint(event) });
                    }
                  : undefined
              }
              onPointerUp={
                editable
                  ? (event) => {
                      if (drag?.index !== index) return;
                      event.stopPropagation();
                      (event.target as Element).releasePointerCapture(
                        event.pointerId,
                      );
                      const next = groundPoint(event);
                      setDrag(null);
                      onDragChange(false);
                      const original = path.waypoints[index] ?? path.end;
                      if (
                        dragMoved.current &&
                        (next.x !== original.x || next.z !== original.z)
                      )
                        onMovePoint(index, next);
                      dragStart.current = null;
                      dragMoved.current = false;
                    }
                  : undefined
              }
              onPointerCancel={() => {
                setDrag(null);
                dragStart.current = null;
                dragMoved.current = false;
                onDragChange(false);
              }}
            >
              <cylinderGeometry
                args={
                  editable ? [0.18, 0.18, 0.045, 24] : [0.08, 0.08, 0.03, 16]
                }
              />
              <meshBasicMaterial
                color={isEnd ? "#ee8f46" : "#4b9e97"}
                depthTest={false}
              />
            </mesh>
            {editable && (
              <>
                <mesh
                  position={[point.x, 0.19, point.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={() => null}
                >
                  <ringGeometry args={[0.19, 0.23, 28]} />
                  <meshBasicMaterial
                    color={isEnd ? "#65350f" : "#174e4a"}
                    side={THREE.DoubleSide}
                    depthTest={false}
                  />
                </mesh>
                <PlanLabel
                  text={`${actor.name} ${isEnd ? "end" : index + 1}`}
                  x={point.x + 0.6}
                  z={point.z - 0.34}
                  color={isEnd ? "#65350f" : "#174e4a"}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

function CameraRoute({
  camera,
  shot,
  editable,
  items,
  routeCollisions,
  onMovePoint,
  onDragChange,
}: {
  camera: SceneItem;
  shot: Shot;
  editable: boolean;
  items: SceneItem[];
  routeCollisions: CameraRouteCollision[];
  onMovePoint: (index: number, point: { x: number; z: number }) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const [drag, setDrag] = useState<{
    index: number;
    point: { x: number; z: number };
  } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  if (!shot.cameraEnd) return null;
  const marks = [...(shot.cameraWaypoints ?? []), shot.cameraEnd].map(
    (point, index) =>
      drag?.index === index ? { ...point, ...drag.point } : point,
  );
  const draftShot = {
    ...shot,
    cameraWaypoints: marks.slice(0, -1),
    cameraEnd: marks.at(-1),
  };
  const groundPoint = (event: ThreeEvent<PointerEvent>) => {
    const intersection = new THREE.Vector3();
    event.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      intersection,
    );
    return snapWallPoint(intersection, items);
  };
  return (
    <group>
      <Line
        points={Array.from({ length: 49 }, (_, index) =>
          cameraPoseAt(camera, draftShot, index / 48),
        ).map((point) => [point.x, 0.055, point.z] as [number, number, number])}
        color="#df7540"
        lineWidth={2}
        raycast={() => null}
      />
      {marks.map((point, index) => {
        const isEnd = index === marks.length - 1;
        return (
          <group key={index}>
            <mesh
              position={[point.x, editable ? 0.16 : 0.065, point.z]}
              onPointerDown={
                editable
                  ? (event) => {
                      event.stopPropagation();
                      (event.target as Element).setPointerCapture(
                        event.pointerId,
                      );
                      setDrag({ index, point: { x: point.x, z: point.z } });
                      dragStart.current = {
                        x: event.clientX,
                        y: event.clientY,
                      };
                      dragMoved.current = false;
                      onDragChange(true);
                    }
                  : undefined
              }
              onPointerMove={
                editable
                  ? (event) => {
                      if (drag?.index !== index) return;
                      event.stopPropagation();
                      if (
                        dragStart.current &&
                        Math.hypot(
                          event.clientX - dragStart.current.x,
                          event.clientY - dragStart.current.y,
                        ) > 4
                      )
                        dragMoved.current = true;
                      if (dragMoved.current)
                        setDrag({ index, point: groundPoint(event) });
                    }
                  : undefined
              }
              onPointerUp={
                editable
                  ? (event) => {
                      if (drag?.index !== index) return;
                      event.stopPropagation();
                      (event.target as Element).releasePointerCapture(
                        event.pointerId,
                      );
                      const next = groundPoint(event);
                      setDrag(null);
                      onDragChange(false);
                      const original =
                        shot.cameraWaypoints?.[index] ?? shot.cameraEnd;
                      if (!original) return;
                      if (
                        dragMoved.current &&
                        (next.x !== original.x || next.z !== original.z)
                      )
                        onMovePoint(index, next);
                      dragStart.current = null;
                      dragMoved.current = false;
                    }
                  : undefined
              }
              onPointerCancel={() => {
                setDrag(null);
                dragStart.current = null;
                dragMoved.current = false;
                onDragChange(false);
              }}
            >
              <cylinderGeometry
                args={
                  editable ? [0.18, 0.18, 0.045, 24] : [0.09, 0.09, 0.03, 16]
                }
              />
              <meshBasicMaterial
                color={isEnd ? "#faad6a" : "#df7540"}
                depthTest={false}
              />
            </mesh>
            {editable && (
              <PlanLabel
                text={`Camera ${isEnd ? "end" : index + 1}`}
                x={point.x + 0.6}
                z={point.z - 0.34}
                color="#8d4529"
              />
            )}
          </group>
        );
      })}
      {routeCollisions.map((collision) => (
        <mesh
          key={collision.wallId}
          position={[collision.x, 0.075, collision.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[0.15, 0.23, 24]} />
          <meshBasicMaterial color="#d63c35" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function StageContent({
  scene,
  shot,
  routeCollisions,
  actorCollisions,
  selectedId,
  selectedIds,
  mode,
  transformMode,
  tool,
  poseMode,
  onSelect,
  onMove,
  onRotate,
  onMoveActorPathPoint,
  onMoveCameraPathPoint,
  onPoseJoints,
  onAddWall,
  onAddRoom,
  onAddPolygonRoom,
  onMoveCorner,
  calibrationPoints,
  onCalibrationPoint,
  moveProgress,
  lightTraceVisible,
  lightRaySamples,
  lightSample,
  onLightSample,
}: Omit<Props, "captureRef">) {
  const [routeDragging, setRouteDragging] = useState<string | null>(null);
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
    const keys = shot?.actorPoseKeys?.[item.id];
    if (keys?.length) return keyedPoseAt(keys, moveProgress);
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
  const [polygonPoints, setPolygonPoints] = useState<PlanPoint[]>([]);
  const [polygonCursor, setPolygonCursor] = useState<PlanPoint | null>(null);
  useEffect(() => {
    if (tool !== "polygon" || mode !== "plan") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPolygonPoints([]);
        setPolygonCursor(null);
      } else if (event.key === "Enter" && polygonPoints.length >= 3) {
        onAddPolygonRoom(polygonPoints);
        setPolygonPoints([]);
        setPolygonCursor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool, mode, polygonPoints, onAddPolygonRoom]);
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
  const roomFinishes = useMemo(
    () => rooms.map((room) => roomFinishFor(room, scene.roomFinishes)),
    [rooms, scene.roomFinishes],
  );
  const roomTextures = useMemo(
    () => ({
      timber: roomTexture("timber"),
      tile: roomTexture("tile"),
      concrete: roomTexture("concrete"),
      stone: roomTexture("stone"),
    }),
    [],
  );
  useEffect(
    () => () =>
      Object.values(roomTextures).forEach((texture) => texture.dispose()),
    [roomTextures],
  );
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
      .filter((item) => item.kind === "wall" && !item.hidden)
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
    onSelect(id, event.nativeEvent.shiftKey);
  };
  return (
    <>
      <CameraRig
        mode={mode}
        poseTarget={poseTarget}
        cameraItem={cameraItem}
        targetActor={visualItems.find(
          (item) => item.id === shot?.cameraTargetActorId,
        )}
        aspectRatio={shot?.aspectRatio ?? "16:9"}
        shot={shot}
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
          if (tool === "polygon" && mode === "plan") {
            event.stopPropagation();
            const point = snap(event.point);
            if (
              polygonPoints.length >= 3 &&
              Math.hypot(
                point.x - polygonPoints[0].x,
                point.z - polygonPoints[0].z,
              ) < 0.3
            ) {
              onAddPolygonRoom(polygonPoints);
              setPolygonPoints([]);
              setPolygonCursor(null);
            } else if (
              polygonPoints.length === 0 ||
              Math.hypot(
                point.x - polygonPoints.at(-1)!.x,
                point.z - polygonPoints.at(-1)!.z,
              ) >= 0.25
            ) {
              setPolygonPoints([...polygonPoints, point]);
              setPolygonCursor(point);
            }
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
          if (tool === "polygon" && polygonPoints.length)
            setPolygonCursor(snap(event.point));
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
                    map={roomTextures[roomFinishes[index]]}
                    color="#ffffff"
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
      {tool === "polygon" && mode === "plan" && polygonPoints.length > 0 && (
        <>
          <Line
            points={[
              ...polygonPoints,
              ...(polygonCursor ? [polygonCursor] : []),
            ].map((point) => [point.x, 0.14, point.z])}
            color="#eb8950"
            lineWidth={3}
            raycast={() => null}
          />
          {polygonPoints.map((point, index) => (
            <mesh
              key={index}
              position={[point.x, 0.15, point.z]}
              raycast={() => null}
            >
              <sphereGeometry args={[index === 0 ? 0.13 : 0.08, 12, 8]} />
              <meshBasicMaterial color={index === 0 ? "#f6d59a" : "#eb8950"} />
            </mesh>
          ))}
        </>
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
        visualItems
          .filter(
            (item) =>
              selectedIds.includes(item.id) &&
              item.kind !== "wall" &&
              !item.hidden,
          )
          .map((item) => (
            <PlanDimensions key={`dimensions-${item.id}`} item={item} />
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
        <LightTraceOverlay items={visualItems} samples={lightRaySamples} />
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
          selectedIds.length === 1 &&
          mode !== "camera" &&
          (tool === "select" || mode !== "plan") &&
          !item.locked ? (
            <SelectedObject
              key={`${shot?.id ?? "scene"}-${item.id}`}
              item={item}
              actorJoints={jointsAt(item)}
              walkPhase={
                shot?.actorPaths?.[item.id]
                  ? moveProgress * Math.PI * 6
                  : undefined
              }
              poseMode={poseMode}
              mode={mode}
              transformMode={transformMode}
              onSelect={onSelect}
              onMove={onMove}
              onRotate={onRotate}
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
              {selectedIds.includes(item.id) && mode !== "camera" && (
                <mesh
                  position={[0, Math.max(0.3, item.height / 2), 0]}
                  raycast={() => null}
                >
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
              )}
            </group>
          ),
        )}
      {mode !== "camera" &&
        Object.entries(shot?.actorPaths ?? {}).map(([actorId, path]) => {
          const actor = scene.items.find((item) => item.id === actorId);
          if (!actor || actor.hidden) return null;
          const start = shot?.actorMarks?.[actorId] ?? actor;
          return (
            <ActorRoute
              key={`actor-path-${shot?.id}-${actorId}`}
              actor={actor}
              start={start}
              path={path}
              editable={
                mode === "plan" &&
                tool === "select" &&
                selectedId === actorId &&
                selectedIds.length === 1 &&
                !actor.locked &&
                moveProgress === 0
              }
              items={scene.items}
              onMovePoint={(index, point) =>
                onMoveActorPathPoint(actorId, index, point)
              }
              onDragChange={(dragging) =>
                setRouteDragging(dragging ? `${shot?.id}:${actorId}` : null)
              }
            />
          );
        })}
      {mode === "plan" &&
        actorCollisions.map((collision) => (
          <mesh
            key={`actor-collision-${collision.wallId}`}
            position={[collision.x, 0.09, collision.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry args={[0.19, 0.28, 24]} />
            <meshBasicMaterial color="#d63c35" side={THREE.DoubleSide} />
          </mesh>
        ))}
      {mode !== "camera" &&
        Object.entries(shot?.lightKeys ?? {}).map(([lightId, keys]) => {
          const light = scene.items.find((item) => item.id === lightId);
          if (
            !light ||
            light.hidden ||
            keys.length < 2 ||
            selectedId !== lightId
          )
            return null;
          return (
            <group key={`light-route-${lightId}`}>
              <Line
                points={keys.map((key) => [
                  key.x,
                  mode === "plan" ? 0.12 : key.y + light.height,
                  key.z,
                ])}
                color="#e8a123"
                lineWidth={2}
                raycast={() => null}
              />
              {keys.map((key) => (
                <mesh
                  key={key.at}
                  position={[
                    key.x,
                    mode === "plan" ? 0.13 : key.y + light.height,
                    key.z,
                  ]}
                  raycast={() => null}
                >
                  <sphereGeometry args={[0.09, 12, 8]} />
                  <meshBasicMaterial color="#e8a123" depthTest={false} />
                </mesh>
              ))}
            </group>
          );
        })}
      {mode !== "camera" && cameraItem && shot?.cameraEnd && (
        <CameraRoute
          camera={cameraItem}
          shot={shot}
          editable={
            mode === "plan" &&
            tool === "select" &&
            selectedId === cameraItem.id &&
            selectedIds.length === 1 &&
            !cameraItem.locked &&
            moveProgress === 0
          }
          items={scene.items}
          routeCollisions={routeCollisions}
          onMovePoint={onMoveCameraPathPoint}
          onDragChange={(dragging) =>
            setRouteDragging(dragging ? `camera:${shot.id}` : null)
          }
        />
      )}
      {mode !== "camera" && (
        <OrbitControls
          enabled={tool === "select" && !routeDragging}
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
    >
      <CaptureBridge captureRef={captureRef} />
      <color
        attach="background"
        args={[props.scene.environment?.skyColor ?? "#dce0de"]}
      />
      <StageContent {...content} />
    </Canvas>
  );
}

function CaptureBridge({ captureRef }: Pick<Props, "captureRef">) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = (options) => {
      if (!options) return gl.domElement.toDataURL("image/png");
      const originalSize = gl.getSize(new THREE.Vector2());
      const originalRatio = gl.getPixelRatio();
      const captureCamera = (camera as THREE.PerspectiveCamera).clone();
      captureCamera.aspect = options.width / options.height;
      captureCamera.fov = options.fov;
      captureCamera.updateProjectionMatrix();
      gl.setPixelRatio(1);
      gl.setSize(options.width, options.height, false);
      try {
        gl.render(scene, captureCamera);
        return gl.domElement.toDataURL("image/png");
      } finally {
        gl.setPixelRatio(originalRatio);
        gl.setSize(originalSize.x, originalSize.y, false);
        gl.render(scene, camera);
      }
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, captureRef]);
  return null;
}
