import { useMemo } from "react";
import * as THREE from "three";
import type { SceneItem } from "./model";

const bark = "#5b4636";
const castIron = "#2f3333";
const rubber = "#1c1d1f";
const chrome = "#b9bcbd";
const glass = "#22303a";

function Box({
  position,
  size,
  color,
  rotation,
  roughness = 0.82,
  metalness = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

const foliageClusters: [number, number, number, number][] = [
  [0, 0.72, 0, 0.34],
  [0.2, 0.62, 0.12, 0.26],
  [-0.22, 0.6, -0.08, 0.27],
  [0.06, 0.6, -0.24, 0.24],
  [-0.08, 0.64, 0.24, 0.24],
  [0.14, 0.84, -0.06, 0.24],
  [-0.12, 0.86, 0.08, 0.22],
  [0, 0.94, 0, 0.18],
];

const branches: [number, number, number][] = [
  [0.5, 0.42, 0.75],
  [2.4, 0.48, 0.7],
  [4.2, 0.4, 0.8],
];

export function Tree({ item }: { item: SceneItem }) {
  const foliage = item.color ?? "#617d4d";
  const shades = useMemo(
    () =>
      foliageClusters.map(
        (_, index) =>
          `#${new THREE.Color(foliage)
            .offsetHSL(
              ((index % 3) - 1) * 0.012,
              0,
              ((index % 4) - 1.5) * 0.035,
            )
            .getHexString()}`,
      ),
    [foliage],
  );

  return (
    <group scale={[item.width, item.height / 1.12, item.depth]}>
      <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.54, 10]} />
        <meshStandardMaterial color={bark} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.03, 10]} />
        <meshStandardMaterial color={bark} roughness={0.95} />
      </mesh>
      {branches.map(([angle, height, tilt]) => (
        <mesh
          key={angle}
          position={[
            Math.cos(angle) * 0.07,
            height + 0.06,
            Math.sin(angle) * 0.07,
          ]}
          rotation={[Math.sin(angle) * tilt, 0, -Math.cos(angle) * tilt]}
          castShadow
        >
          <cylinderGeometry args={[0.014, 0.026, 0.2, 6]} />
          <meshStandardMaterial color={bark} roughness={0.95} />
        </mesh>
      ))}
      {foliageClusters.map(([x, y, z, radius], index) => (
        <mesh key={index} position={[x, y, z]} castShadow receiveShadow>
          <icosahedronGeometry args={[radius, 1]} />
          <meshStandardMaterial
            color={shades[index]}
            roughness={0.9}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

export function Bench({ item }: { item: SceneItem }) {
  const { width: w, height: h, depth: d } = item;
  const slat = item.color ?? "#8b6548";
  const seatY = h * 0.45;
  const slatThickness = Math.min(0.035, h * 0.04);
  const seatDepth = d * 0.62;
  const seatSlats = 4;
  const seatSlatDepth = (seatDepth / seatSlats) * 0.8;
  const backSlats = 3;
  const backHeight = h - seatY - slatThickness;
  const backSlatHeight = (backHeight / backSlats) * 0.62;
  const backZ = -d / 2 + d * 0.16;
  const frameX = w / 2 - Math.min(0.08, w * 0.06);
  const frameThickness = Math.min(0.05, w * 0.04);
  const frames = w > 1.4 ? [-frameX, 0, frameX] : [-frameX, frameX];
  const seatCenterZ = backZ + seatDepth / 2 + d * 0.04;

  return (
    <group>
      {Array.from({ length: seatSlats }, (_, index) => (
        <Box
          key={`seat-${index}`}
          position={[
            0,
            seatY,
            seatCenterZ -
              seatDepth / 2 +
              (index + 0.5) * (seatDepth / seatSlats),
          ]}
          size={[w, slatThickness, seatSlatDepth]}
          color={slat}
        />
      ))}
      <group
        position={[0, seatY + slatThickness, backZ]}
        rotation={[-0.16, 0, 0]}
      >
        {Array.from({ length: backSlats }, (_, index) => (
          <Box
            key={`back-${index}`}
            position={[0, (index + 0.6) * (backHeight / backSlats), 0]}
            size={[w, backSlatHeight, slatThickness]}
            color={slat}
          />
        ))}
      </group>
      {frames.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box
            position={[
              0,
              seatY / 2,
              seatCenterZ + seatDepth / 2 - frameThickness,
            ]}
            size={[frameThickness, seatY, frameThickness]}
            color={castIron}
            roughness={0.6}
            metalness={0.4}
          />
          <Box
            position={[0, (seatY + backHeight * 0.95) / 2, backZ]}
            size={[frameThickness, seatY + backHeight * 0.95, frameThickness]}
            color={castIron}
            roughness={0.6}
            metalness={0.4}
          />
          <Box
            position={[
              0,
              seatY - slatThickness,
              seatCenterZ - frameThickness / 2,
            ]}
            size={[frameThickness, slatThickness, seatDepth + d * 0.06]}
            color={castIron}
            roughness={0.6}
            metalness={0.4}
          />
          <Box
            position={[0, seatY * 0.18, seatCenterZ - frameThickness / 2]}
            size={[frameThickness, frameThickness * 0.8, seatDepth + d * 0.06]}
            color={castIron}
            roughness={0.6}
            metalness={0.4}
          />
          {x !== 0 && (
            <Box
              position={[0, seatY + h * 0.2, seatCenterZ - frameThickness]}
              size={[
                frameThickness * 1.4,
                frameThickness * 0.8,
                seatDepth * 0.95,
              ]}
              color={castIron}
              roughness={0.6}
              metalness={0.4}
            />
          )}
          {x !== 0 && (
            <Box
              position={[
                0,
                seatY + h * 0.1,
                seatCenterZ + seatDepth / 2 - frameThickness,
              ]}
              size={[frameThickness, h * 0.2, frameThickness]}
              color={castIron}
              roughness={0.6}
              metalness={0.4}
            />
          )}
        </group>
      ))}
    </group>
  );
}

function Wheel({
  position,
  radius,
  width,
  outward,
}: {
  position: [number, number, number];
  radius: number;
  width: number;
  outward: 1 | -1;
}) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial color={rubber} roughness={0.92} />
      </mesh>
      <mesh
        position={[0, (outward * width) / 2 + outward * 0.002, 0]}
        castShadow
      >
        <cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.01, 20]} />
        <meshStandardMaterial color={chrome} roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0, (outward * width) / 2 + outward * 0.008, 0]}>
        <cylinderGeometry args={[radius * 0.16, radius * 0.16, 0.012, 12]} />
        <meshStandardMaterial
          color={castIron}
          roughness={0.5}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

export function Vehicle({ item }: { item: SceneItem }) {
  const { width: length, height: h, depth: d } = item;
  const paint = item.color ?? "#5d6f7d";
  const wheelRadius = Math.min(h * 0.24, length * 0.085);
  const tireWidth = Math.min(d * 0.13, 0.24);
  const bodyBottom = wheelRadius * 0.5;
  const bodyHeight = h * 0.4;
  const bodyTop = bodyBottom + bodyHeight;
  const cabinHeight = h - bodyTop;
  const cabinLength = length * 0.48;
  const cabinX = -length * 0.04;
  const cabinDepth = d * 0.84;
  const axleX = length * 0.32;
  const wheelZ = d / 2 - tireWidth / 2;
  const lampY = bodyBottom + bodyHeight * 0.7;

  return (
    <group>
      <Box
        position={[0, bodyBottom + bodyHeight / 2, 0]}
        size={[length, bodyHeight, d]}
        color={paint}
        roughness={0.35}
        metalness={0.35}
      />
      <Box
        position={[length * 0.27, bodyTop + 0.004, 0]}
        size={[length * 0.4, 0.008, d * 0.92]}
        color={paint}
        roughness={0.3}
        metalness={0.35}
      />
      <Box
        position={[cabinX, bodyTop + cabinHeight / 2, 0]}
        size={[cabinLength, cabinHeight, cabinDepth]}
        color={paint}
        roughness={0.35}
        metalness={0.35}
      />
      <Box
        position={[cabinX, bodyTop + cabinHeight * 0.48, 0]}
        size={[cabinLength * 0.9, cabinHeight * 0.62, cabinDepth + 0.01]}
        color={glass}
        roughness={0.12}
        metalness={0.6}
      />
      <Box
        position={[cabinX, bodyTop + cabinHeight * 0.48, 0]}
        size={[cabinLength + 0.01, cabinHeight * 0.62, cabinDepth * 0.86]}
        color={glass}
        roughness={0.12}
        metalness={0.6}
      />
      <Box
        position={[
          cabinX + cabinLength * 0.02,
          bodyTop + cabinHeight * 0.48,
          0,
        ]}
        size={[cabinLength * 0.04, cabinHeight * 0.64, cabinDepth + 0.014]}
        color={paint}
        roughness={0.35}
        metalness={0.35}
      />
      {[1, -1].map((side) => (
        <group key={`side-${side}`}>
          <Box
            position={[
              cabinX + cabinLength / 2 + length * 0.02,
              bodyTop + 0.06,
              (side * d) / 2,
            ]}
            size={[0.08, 0.05, 0.1]}
            color={paint}
            roughness={0.35}
            metalness={0.35}
          />
          <Box
            position={[
              length * 0.04,
              bodyBottom + bodyHeight * 0.62,
              (side * d) / 2 + side * 0.006,
            ]}
            size={[0.1, 0.02, 0.012]}
            color={chrome}
            roughness={0.3}
            metalness={0.85}
          />
          <Box
            position={[
              -length * 0.16,
              bodyBottom + bodyHeight * 0.62,
              (side * d) / 2 + side * 0.006,
            ]}
            size={[0.1, 0.02, 0.012]}
            color={chrome}
            roughness={0.3}
            metalness={0.85}
          />
          <Box
            position={[length / 2 + 0.004, lampY, side * d * 0.33]}
            size={[0.012, bodyHeight * 0.18, d * 0.2]}
            color="#e9e4cf"
            roughness={0.2}
          />
          <Box
            position={[-length / 2 - 0.004, lampY, side * d * 0.36]}
            size={[0.012, bodyHeight * 0.16, d * 0.16]}
            color="#8f1f1d"
            roughness={0.3}
          />
          {[axleX, -axleX].map((x) => (
            <Wheel
              key={x}
              position={[x, wheelRadius, side * wheelZ]}
              radius={wheelRadius}
              width={tireWidth}
              outward={side as 1 | -1}
            />
          ))}
        </group>
      ))}
      <Box
        position={[length / 2 - 0.02, bodyBottom + bodyHeight * 0.18, 0]}
        size={[0.08, bodyHeight * 0.26, d * 1.01]}
        color={rubber}
        roughness={0.7}
      />
      <Box
        position={[-length / 2 + 0.02, bodyBottom + bodyHeight * 0.18, 0]}
        size={[0.08, bodyHeight * 0.26, d * 1.01]}
        color={rubber}
        roughness={0.7}
      />
      <Box
        position={[length / 2 + 0.004, lampY - bodyHeight * 0.18, 0]}
        size={[0.012, bodyHeight * 0.16, d * 0.34]}
        color={castIron}
        roughness={0.5}
        metalness={0.5}
      />
    </group>
  );
}
