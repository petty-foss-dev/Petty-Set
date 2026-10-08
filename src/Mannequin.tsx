import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SceneItem } from "./model";

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
  walkPhase = 0,
}: {
  item: SceneItem;
  walkPhase?: number;
}) {
  const map = useMemo(() => grainTexture(), []);
  useEffect(() => () => map.dispose(), [map]);
  const color = item.color ?? "#d2ab7d";
  const connector = "#745235";
  const swing = Math.sin(walkPhase);
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
      <Piece
        geometry={joint}
        position={[0, 1.43, 0]}
        scale={[0.065, 0.055, 0.065]}
        color={connector}
      />
      <Piece geometry={head} position={[0, 1.55, 0]} color={color} map={map} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <group
            position={[side * 0.255, 1.36, 0]}
            rotation={[side * swing * 0.22, 0, 0]}
          >
            <group position={[-side * 0.255, -1.36, 0]}>
              <Piece
                geometry={joint}
                position={[side * 0.255, 1.36, 0]}
                scale={[0.085, 0.08, 0.085]}
                color={color}
                map={map}
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
            </group>
          </group>
          <group
            position={[side * 0.105, 0.63, 0]}
            rotation={[-side * swing * 0.28, 0, 0]}
          >
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
      ))}
    </group>
  );
}
