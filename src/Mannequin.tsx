import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mannequinJointControls, mannequinJointsForPose } from "./model";
import type { MannequinJoints, SceneItem } from "./model";

type PoseHandle =
  | "head"
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftHip"
  | "rightHip"
  | "leftKnee"
  | "rightKnee";

function turned(points: [number, number][]) {
  return new THREE.LatheGeometry(
    points.map(([radius, y]) => new THREE.Vector2(radius, y)),
    24,
  );
}

const head = turned([
  [0.055, -0.18],
  [0.115, -0.15],
  [0.14, -0.07],
  [0.145, 0.07],
  [0.12, 0.16],
  [0.06, 0.2],
  [0, 0.205],
]);
const chest = turned([
  [0.11, -0.22],
  [0.16, -0.18],
  [0.2, -0.08],
  [0.225, 0.06],
  [0.24, 0.15],
  [0.18, 0.19],
  [0.085, 0.2],
]);
const pelvis = turned([
  [0.11, -0.15],
  [0.2, -0.12],
  [0.22, -0.02],
  [0.19, 0.12],
  [0.13, 0.16],
]);
const upperArm = turned([
  [0.042, -0.15],
  [0.07, -0.11],
  [0.078, 0.04],
  [0.065, 0.13],
  [0.035, 0.15],
]);
const forearm = turned([
  [0.032, -0.15],
  [0.058, -0.11],
  [0.068, 0.07],
  [0.05, 0.13],
  [0.026, 0.15],
]);
const thigh = turned([
  [0.056, -0.18],
  [0.078, -0.13],
  [0.096, 0.08],
  [0.085, 0.16],
  [0.046, 0.18],
]);
const shin = turned([
  [0.038, -0.18],
  [0.057, -0.13],
  [0.075, 0.06],
  [0.058, 0.15],
  [0.03, 0.18],
]);
const joint = new THREE.SphereGeometry(1, 16, 12);
const hand = new THREE.SphereGeometry(1, 16, 12);
const foot = new THREE.SphereGeometry(1, 20, 12);

function grainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f7f1e4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 80; i++) {
    const x = (i * 73) % canvas.width;
    const wobble = Math.sin(i * 2.3) * 7;
    context.strokeStyle =
      i % 5 === 0 ? "rgba(117,69,30,.16)" : "rgba(117,69,30,.07)";
    context.lineWidth = i % 7 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(x, -10);
    context.bezierCurveTo(
      x + wobble,
      150,
      x - wobble,
      320,
      x + wobble / 2,
      522,
    );
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Piece({
  geometry,
  position,
  rotation,
  scale,
  color,
  map,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color: string;
  map?: THREE.Texture;
}) {
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      dispose={null}
    >
      <meshStandardMaterial
        color={color}
        map={map}
        roughness={0.82}
        metalness={0}
      />
    </mesh>
  );
}

export default function Mannequin({
  item,
  joints,
  walkPhase = 0,
  poseHandles = false,
  onPosePreview,
  onPoseCommit,
}: {
  item: SceneItem;
  joints?: MannequinJoints;
  walkPhase?: number;
  poseHandles?: boolean;
  onPosePreview?: (joints: MannequinJoints) => void;
  onPoseCommit?: (joints: MannequinJoints) => void;
}) {
  const map = useMemo(() => grainTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  const color = item.color ?? "#d2ab7d";
  const connector = "#745235";
  const pose = joints ?? mannequinJointsForPose(item.mannequinPose);
  const swing = Math.sin(walkPhase);
  const radians = THREE.MathUtils.degToRad;
  const gesture = useRef<{
    handle: PoseHandle;
    x: number;
    y: number;
    start: MannequinJoints;
    current: MannequinJoints;
    moved: boolean;
  } | null>(null);
  const moveHandle = (event: ThreeEvent<PointerEvent>) => {
    const active = gesture.current;
    if (!active) return;
    event.stopPropagation();
    const dx = event.nativeEvent.clientX - active.x;
    const dy = event.nativeEvent.clientY - active.y;
    const next = { ...active.start };
    const adjust = (key: keyof MannequinJoints, delta: number) => {
      const control = mannequinJointControls.find(
        (value) => value.key === key,
      )!;
      next[key] = Math.round(
        THREE.MathUtils.clamp(
          active.start[key] + delta,
          control.min,
          control.max,
        ),
      );
    };
    switch (active.handle) {
      case "head":
        adjust("headTilt", dx * 0.6);
        adjust("headNod", -dy * 0.6);
        break;
      case "leftShoulder":
      case "rightShoulder": {
        const left = active.handle === "leftShoulder";
        adjust(left ? "leftArmLift" : "rightArmLift", dx * (left ? -0.9 : 0.9));
        adjust(left ? "leftShoulderSwing" : "rightShoulderSwing", -dy * 0.9);
        break;
      }
      case "leftElbow":
      case "rightElbow":
        adjust(
          active.handle === "leftElbow" ? "leftElbowBend" : "rightElbowBend",
          -dy,
        );
        break;
      case "leftHip":
      case "rightHip":
        adjust(
          active.handle === "leftHip" ? "leftHipSwing" : "rightHipSwing",
          -dy * 0.8,
        );
        break;
      case "leftKnee":
      case "rightKnee":
        adjust(
          active.handle === "leftKnee" ? "leftKneeBend" : "rightKneeBend",
          -dy,
        );
        break;
    }
    active.current = next;
    active.moved = mannequinJointControls.some(
      ({ key }) => next[key] !== active.start[key],
    );
    onPosePreview?.(next);
  };
  const poseHandle = (handle: PoseHandle) =>
    poseHandles && (
      <mesh
        position={[0, 0, 0.12]}
        renderOrder={10}
        onPointerDown={(event) => {
          event.stopPropagation();
          (event.target as Element).setPointerCapture(event.pointerId);
          gesture.current = {
            handle,
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
            start: { ...pose },
            current: pose,
            moved: false,
          };
        }}
        onPointerMove={moveHandle}
        onPointerUp={(event) => {
          event.stopPropagation();
          (event.target as Element).releasePointerCapture(event.pointerId);
          const active = gesture.current;
          gesture.current = null;
          if (active?.moved) onPoseCommit?.(active.current);
        }}
        onPointerCancel={() => {
          if (gesture.current) onPosePreview?.(gesture.current.start);
          gesture.current = null;
        }}
        onPointerOver={() => (document.body.style.cursor = "grab")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.057, 16, 12]} />
        <meshBasicMaterial color="#f9a64b" depthTest={false} />
      </mesh>
    );
  return (
    <group scale={[item.width / 0.5, item.height / 1.75, item.depth / 0.4]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color="#dc7542" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.08, 0.34]} />
        <meshStandardMaterial color="#6f482c" map={map} roughness={0.86} />
      </mesh>
      <Piece
        geometry={pelvis}
        position={[0, 0.78, 0]}
        color={color}
        map={map}
      />
      <Piece
        geometry={joint}
        position={[0, 0.96, 0]}
        scale={[0.1, 0.09, 0.1]}
        color={connector}
      />
      <Piece geometry={chest} position={[0, 1.2, 0]} color={color} map={map} />
      <mesh position={[0, 1.42, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.09, 0.055, 18]} />
        <meshStandardMaterial color={color} map={map} roughness={0.82} />
      </mesh>
      <Piece
        geometry={joint}
        position={[0, 1.43, 0]}
        scale={[0.065, 0.055, 0.065]}
        color={connector}
      />
      <group
        position={[0, 1.43, 0]}
        rotation={[radians(pose.headNod), 0, radians(pose.headTilt)]}
      >
        {poseHandle("head")}
        <Piece
          geometry={head}
          position={[0, 0.12, 0]}
          color={color}
          map={map}
        />
        <mesh position={[0, -0.04, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.075, 0.035, 18]} />
          <meshStandardMaterial color={connector} roughness={0.76} />
        </mesh>
      </group>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <group
            position={[side * 0.255, 1.36, 0]}
            rotation={[
              -radians(
                side === -1 ? pose.leftShoulderSwing : pose.rightShoulderSwing,
              ) +
                side * swing * 0.22,
              0,
              side *
                radians(side === -1 ? pose.leftArmLift : pose.rightArmLift),
            ]}
          >
            {poseHandle(side === -1 ? "leftShoulder" : "rightShoulder")}
            <group position={[-side * 0.255, -1.36, 0]}>
              <Piece
                geometry={joint}
                position={[side * 0.255, 1.36, 0]}
                scale={[0.085, 0.08, 0.085]}
                color={color}
                map={map}
              />
              <Piece
                geometry={joint}
                position={[side * 0.338, 1.36, 0]}
                scale={[0.018, 0.028, 0.028]}
                color={connector}
              />
              <Piece
                geometry={upperArm}
                position={[side * 0.28, 1.18, 0]}
                rotation={[0, 0, side * 0.09]}
                color={color}
                map={map}
              />
              <Piece
                geometry={joint}
                position={[side * 0.3, 1.01, 0]}
                scale={[0.055, 0.055, 0.055]}
                color={connector}
              />
              <group
                position={[side * 0.3, 1.01, 0]}
                rotation={[
                  0,
                  0,
                  -side *
                    radians(
                      side === -1 ? pose.leftElbowBend : pose.rightElbowBend,
                    ),
                ]}
              >
                {poseHandle(side === -1 ? "leftElbow" : "rightElbow")}
                <group position={[-side * 0.3, -1.01, 0]}>
                  <Piece
                    geometry={forearm}
                    position={[side * 0.31, 0.84, 0]}
                    rotation={[0, 0, side * 0.03]}
                    color={color}
                    map={map}
                  />
                  <Piece
                    geometry={joint}
                    position={[side * 0.315, 0.67, 0]}
                    scale={[0.04, 0.045, 0.04]}
                    color={connector}
                  />
                  <Piece
                    geometry={hand}
                    position={[side * 0.32, 0.55, -0.015]}
                    rotation={[0, 0, side * 0.15]}
                    scale={[0.045, 0.105, 0.027]}
                    color={color}
                    map={map}
                  />
                  <Piece
                    geometry={hand}
                    position={[side * 0.37, 0.61, 0.025]}
                    rotation={[0, 0, -side * 0.45]}
                    scale={[0.025, 0.055, 0.023]}
                    color={color}
                    map={map}
                  />
                </group>
              </group>
            </group>
          </group>
          <group
            position={[side * 0.105, 0.63, 0]}
            rotation={[
              -radians(side === -1 ? pose.leftHipSwing : pose.rightHipSwing) -
                side * swing * 0.28,
              0,
              0,
            ]}
          >
            {poseHandle(side === -1 ? "leftHip" : "rightHip")}
            <group position={[-side * 0.105, -0.63, 0]}>
              <Piece
                geometry={joint}
                position={[side * 0.105, 0.63, 0]}
                scale={[0.072, 0.07, 0.072]}
                color={connector}
              />
              <Piece
                geometry={thigh}
                position={[side * 0.11, 0.48, 0]}
                color={color}
                map={map}
              />
              <Piece
                geometry={joint}
                position={[side * 0.11, 0.29, 0]}
                scale={[0.062, 0.06, 0.062]}
                color={connector}
              />
              <Piece
                geometry={joint}
                position={[side * 0.174, 0.29, 0]}
                scale={[0.014, 0.025, 0.025]}
                color={color}
                map={map}
              />
              <mesh position={[side * 0.11, 0.36, 0]} castShadow>
                <cylinderGeometry args={[0.068, 0.062, 0.026, 16]} />
                <meshStandardMaterial
                  color={color}
                  map={map}
                  roughness={0.84}
                />
              </mesh>
              <group
                position={[side * 0.11, 0.29, 0]}
                rotation={[
                  radians(side === -1 ? pose.leftKneeBend : pose.rightKneeBend),
                  0,
                  0,
                ]}
              >
                {poseHandle(side === -1 ? "leftKnee" : "rightKnee")}
                <group position={[-side * 0.11, -0.29, 0]}>
                  <Piece
                    geometry={shin}
                    position={[side * 0.11, 0.2, 0]}
                    color={color}
                    map={map}
                  />
                  <Piece
                    geometry={joint}
                    position={[side * 0.11, 0.065, 0]}
                    scale={[0.043, 0.04, 0.043]}
                    color={connector}
                  />
                  <Piece
                    geometry={foot}
                    position={[side * 0.11, 0.09, -0.075]}
                    scale={[0.105, 0.047, 0.17]}
                    color={color}
                    map={map}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
