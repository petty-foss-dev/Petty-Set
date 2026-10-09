import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
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
  const profile = new THREE.SplineCurve(
    points.map(([radius, y]) => new THREE.Vector2(radius, y)),
  ).getPoints(points.length * 6);
  const first = profile[0];
  const last = profile[profile.length - 1];
  // Close open ends with a shallow dome so limbs read as solid turned wood.
  if (first.x > 0.001) profile.unshift(new THREE.Vector2(0, first.y - 0.006));
  if (last.x > 0.001) profile.push(new THREE.Vector2(0, last.y + 0.006));
  return new THREE.LatheGeometry(profile, 40);
}

function plinth(
  width: number,
  depth: number,
  height: number,
  radius: number,
  bevel: number,
) {
  const w = width / 2 - bevel;
  const d = depth / 2 - bevel;
  const r = radius - bevel;
  const shape = new THREE.Shape()
    .moveTo(-w + r, -d)
    .lineTo(w - r, -d)
    .quadraticCurveTo(w, -d, w, -d + r)
    .lineTo(w, d - r)
    .quadraticCurveTo(w, d, w - r, d)
    .lineTo(-w + r, d)
    .quadraticCurveTo(-w, d, -w, d - r)
    .lineTo(-w, -d + r)
    .quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

const head = turned([
  [0.05, -0.18],
  [0.1, -0.155],
  [0.132, -0.095],
  [0.146, 0],
  [0.142, 0.08],
  [0.118, 0.15],
  [0.07, 0.193],
  [0, 0.205],
]);
const chest = turned([
  [0.1, -0.22],
  [0.15, -0.19],
  [0.185, -0.11],
  [0.205, -0.01],
  [0.228, 0.08],
  [0.24, 0.14],
  [0.2, 0.183],
  [0.12, 0.198],
  [0.07, 0.2],
]);
const pelvis = turned([
  [0.12, -0.15],
  [0.19, -0.125],
  [0.218, -0.05],
  [0.212, 0.04],
  [0.185, 0.115],
  [0.13, 0.16],
]);
const upperArm = turned([
  [0.04, -0.15],
  [0.062, -0.125],
  [0.072, -0.06],
  [0.079, 0.03],
  [0.073, 0.1],
  [0.055, 0.138],
  [0.034, 0.15],
]);
const forearm = turned([
  [0.03, -0.15],
  [0.045, -0.13],
  [0.056, -0.07],
  [0.066, 0.03],
  [0.065, 0.085],
  [0.05, 0.13],
  [0.028, 0.15],
]);
const thigh = turned([
  [0.052, -0.18],
  [0.07, -0.15],
  [0.08, -0.08],
  [0.093, 0.03],
  [0.096, 0.1],
  [0.08, 0.155],
  [0.045, 0.18],
]);
const shin = turned([
  [0.036, -0.18],
  [0.05, -0.15],
  [0.058, -0.09],
  [0.072, 0.02],
  [0.074, 0.08],
  [0.06, 0.145],
  [0.03, 0.18],
]);
const palm = turned([
  [0, -0.105],
  [0.03, -0.098],
  [0.042, -0.06],
  [0.046, 0],
  [0.044, 0.05],
  [0.034, 0.09],
  [0.026, 0.105],
]);
const joint = new THREE.SphereGeometry(1, 24, 16);
const foot = new THREE.SphereGeometry(1, 28, 16);
const band = new THREE.TorusGeometry(1, 0.2, 8, 36).rotateX(Math.PI / 2);
const pin = new THREE.CylinderGeometry(1, 1, 1, 16);
const lowerPlinth = plinth(0.46, 0.34, 0.05, 0.05, 0.01);
const upperPlinth = plinth(0.38, 0.26, 0.03, 0.035, 0.007);

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const { width, height } = canvas;
  const context = canvas.getContext("2d")!;
  const random = seeded(17);
  const tone = context.createLinearGradient(0, 0, width, 0);
  tone.addColorStop(0, "#f3e9d6");
  tone.addColorStop(0.5, "#fbf5e8");
  tone.addColorStop(1, "#f3e9d6");
  context.fillStyle = tone;
  context.fillRect(0, 0, width, height);
  // Strokes are repeated across the seam so the lathe wrap stays continuous.
  const streak = (
    x: number,
    wobble: number,
    style: string,
    lineWidth: number,
  ) => {
    context.strokeStyle = style;
    context.lineWidth = lineWidth;
    for (const offset of [-width, 0, width]) {
      context.beginPath();
      context.moveTo(x + offset, -10);
      context.bezierCurveTo(
        x + offset + wobble,
        height * 0.3,
        x + offset - wobble,
        height * 0.62,
        x + offset + wobble / 2,
        height + 10,
      );
      context.stroke();
    }
  };
  for (let i = 0; i < 16; i++) {
    streak(
      random() * width,
      (random() - 0.5) * 22,
      `rgba(156,98,48,${0.018 + random() * 0.025})`,
      6 + random() * 16,
    );
  }
  for (let i = 0; i < 170; i++) {
    const strong = random() < 0.18;
    streak(
      random() * width,
      (random() - 0.5) * 16,
      strong ? "rgba(112,64,28,.09)" : "rgba(117,69,30,.028)",
      strong ? 1.4 : 0.7,
    );
  }
  const knots: [number, number][] = [
    [width * 0.3, height * 0.36],
    [width * 0.78, height * 0.74],
  ];
  for (const [x, y] of knots) {
    context.fillStyle = "rgba(118,70,32,.1)";
    context.beginPath();
    context.ellipse(x, y, 2.5, 5, 0, 0, Math.PI * 2);
    context.fill();
    for (let ring = 1; ring <= 6; ring++) {
      context.strokeStyle = `rgba(112,64,28,${0.09 - ring * 0.01})`;
      context.lineWidth = 0.9;
      context.beginPath();
      context.ellipse(x, y, 2.5 + ring * 3, 6 + ring * 8, 0, 0, Math.PI * 2);
      context.stroke();
    }
  }
  for (let i = 0; i < 1400; i++) {
    context.fillStyle = `rgba(96,56,26,${random() * 0.09})`;
    context.fillRect(random() * width, random() * height, 1, 1 + random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function Piece({
  geometry,
  position,
  rotation,
  scale,
  material,
  children,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material: THREE.Material;
  children?: ReactNode;
}) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      dispose={null}
    >
      {children}
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
  const finish = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({
        color,
        map,
        bumpMap: map,
        bumpScale: 0.035,
        roughness: 0.58,
      }),
      walnut: new THREE.MeshStandardMaterial({
        color: "#6a4529",
        map,
        bumpMap: map,
        bumpScale: 0.024,
        roughness: 0.5,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#c49546",
        roughness: 0.34,
        metalness: 0.85,
      }),
      plinth: new THREE.MeshStandardMaterial({
        color: "#5b3a22",
        map,
        bumpMap: map,
        bumpScale: 0.03,
        roughness: 0.46,
      }),
      plinthTop: new THREE.MeshStandardMaterial({
        color: "#7a5032",
        map,
        bumpMap: map,
        bumpScale: 0.03,
        roughness: 0.52,
      }),
    }),
    [color, map],
  );
  useEffect(
    () => () => Object.values(finish).forEach((material) => material.dispose()),
    [finish],
  );
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
      <Piece
        geometry={lowerPlinth}
        position={[0, 0, 0]}
        material={finish.plinth}
      />
      <Piece
        geometry={upperPlinth}
        position={[0, 0.05, 0]}
        material={finish.plinthTop}
      />
      <Piece
        geometry={pin}
        position={[0, 0.087, 0.08]}
        scale={[0.026, 0.014, 0.026]}
        material={finish.brass}
      />
      <Piece
        geometry={pin}
        position={[0, 0.37, 0.08]}
        scale={[0.011, 0.58, 0.011]}
        material={finish.brass}
      />
      <Piece
        geometry={pin}
        position={[0, 0.645, 0.08]}
        scale={[0.02, 0.026, 0.02]}
        material={finish.walnut}
      />
      <Piece
        geometry={pelvis}
        position={[0, 0.78, 0]}
        scale={[1, 1, 0.82]}
        material={finish.wood}
      />
      <Piece
        geometry={band}
        position={[0, 0.935, 0]}
        scale={[0.13, 0.13, 0.11]}
        material={finish.walnut}
      />
      <Piece
        geometry={joint}
        position={[0, 0.96, 0]}
        scale={[0.1, 0.09, 0.1]}
        material={finish.walnut}
      />
      <Piece
        geometry={band}
        position={[0, 0.985, 0]}
        scale={[0.1, 0.1, 0.085]}
        material={finish.walnut}
      />
      <Piece
        geometry={chest}
        position={[0, 1.2, 0]}
        scale={[1, 1, 0.8]}
        material={finish.wood}
      />
      <Piece
        geometry={band}
        position={[0, 1.4, 0]}
        scale={[0.075, 0.075, 0.068]}
        material={finish.walnut}
      />
      <mesh position={[0, 1.42, 0]} material={finish.wood} castShadow>
        <cylinderGeometry args={[0.072, 0.09, 0.055, 24]} />
      </mesh>
      <Piece
        geometry={joint}
        position={[0, 1.43, 0]}
        scale={[0.065, 0.055, 0.065]}
        material={finish.walnut}
      />
      <group
        position={[0, 1.43, 0]}
        rotation={[radians(pose.headNod), 0, radians(pose.headTilt)]}
      >
        {poseHandle("head")}
        <Piece
          geometry={head}
          position={[0, 0.12, 0]}
          scale={[0.94, 1, 1]}
          material={finish.wood}
        />
        <mesh position={[0, -0.04, 0]} material={finish.walnut} castShadow>
          <cylinderGeometry args={[0.085, 0.075, 0.035, 24]} />
        </mesh>
        <Piece
          geometry={band}
          position={[0, -0.022, 0]}
          scale={[0.084, 0.06, 0.084]}
          material={finish.brass}
        />
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
                material={finish.wood}
              />
              <Piece
                geometry={pin}
                position={[side * 0.335, 1.36, 0]}
                rotation={[0, 0, Math.PI / 2]}
                scale={[0.027, 0.014, 0.027]}
                material={finish.brass}
              />
              <Piece
                geometry={upperArm}
                position={[side * 0.28, 1.18, 0]}
                rotation={[0, 0, side * 0.09]}
                material={finish.wood}
              >
                <Piece
                  geometry={band}
                  position={[0, -0.112, 0]}
                  scale={[0.058, 0.04, 0.058]}
                  material={finish.walnut}
                />
              </Piece>
              <Piece
                geometry={joint}
                position={[side * 0.3, 1.01, 0]}
                scale={[0.055, 0.055, 0.055]}
                material={finish.walnut}
              />
              <Piece
                geometry={pin}
                position={[side * 0.3, 1.01, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[0.016, 0.13, 0.016]}
                material={finish.brass}
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
                    material={finish.wood}
                  >
                    <Piece
                      geometry={band}
                      position={[0, -0.13, 0]}
                      scale={[0.04, 0.035, 0.04]}
                      material={finish.walnut}
                    />
                  </Piece>
                  <Piece
                    geometry={joint}
                    position={[side * 0.315, 0.67, 0]}
                    scale={[0.04, 0.045, 0.04]}
                    material={finish.walnut}
                  />
                  <Piece
                    geometry={palm}
                    position={[side * 0.32, 0.55, -0.015]}
                    rotation={[0, 0, side * 0.15]}
                    scale={[1, 1, 0.6]}
                    material={finish.wood}
                  />
                  <Piece
                    geometry={joint}
                    position={[side * 0.37, 0.61, 0.025]}
                    rotation={[0, 0, -side * 0.45]}
                    scale={[0.025, 0.055, 0.023]}
                    material={finish.wood}
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
                material={finish.walnut}
              />
              <Piece
                geometry={pin}
                position={[side * 0.176, 0.63, 0]}
                rotation={[0, 0, Math.PI / 2]}
                scale={[0.024, 0.012, 0.024]}
                material={finish.brass}
              />
              <Piece
                geometry={thigh}
                position={[side * 0.11, 0.48, 0]}
                material={finish.wood}
              />
              <Piece
                geometry={joint}
                position={[side * 0.11, 0.29, 0]}
                scale={[0.062, 0.06, 0.062]}
                material={finish.walnut}
              />
              <Piece
                geometry={pin}
                position={[side * 0.11, 0.29, 0]}
                rotation={[0, 0, Math.PI / 2]}
                scale={[0.016, 0.142, 0.016]}
                material={finish.brass}
              />
              <mesh
                position={[side * 0.11, 0.36, 0]}
                material={finish.walnut}
                castShadow
              >
                <cylinderGeometry args={[0.068, 0.062, 0.026, 24]} />
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
                    material={finish.wood}
                  >
                    <Piece
                      geometry={band}
                      position={[0, -0.155, 0]}
                      scale={[0.046, 0.035, 0.046]}
                      material={finish.walnut}
                    />
                  </Piece>
                  <Piece
                    geometry={joint}
                    position={[side * 0.11, 0.065, 0]}
                    scale={[0.043, 0.04, 0.043]}
                    material={finish.walnut}
                  />
                  <Piece
                    geometry={foot}
                    position={[side * 0.11, 0.09, -0.075]}
                    scale={[0.105, 0.047, 0.17]}
                    material={finish.wood}
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
