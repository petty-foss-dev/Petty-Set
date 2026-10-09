import * as THREE from "three";
import type { SceneItem } from "./model";

function Block({
  position,
  size,
  color,
  metalness = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  metalness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={metalness ? 0.35 : 0.78}
        metalness={metalness}
      />
    </mesh>
  );
}

function Pin({
  position,
  radius,
  height,
  color,
  rotation,
}: {
  position: [number, number, number];
  radius: number;
  height: number;
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 12]} />
      <meshStandardMaterial color={color} roughness={0.38} metalness={0.55} />
    </mesh>
  );
}

const walnut = "#68452f";
const darkWalnut = "#3f2b22";
const brass = "#b49458";

export function Bed({ item }: { item: SceneItem }) {
  const w = item.width;
  const h = item.height;
  const d = item.depth;
  const railHeight = Math.min(h * 0.36, 0.36);
  const post = Math.min(w * 0.055, 0.09);
  const bedding = item.color ?? "#8e584e";
  return (
    <group>
      <Block
        position={[0, railHeight, 0]}
        size={[w - post, 0.12, d - post]}
        color={walnut}
      />
      <Block
        position={[0, railHeight + 0.105, 0]}
        size={[w - post * 1.8, 0.13, d - post * 1.8]}
        color="#e8dfcf"
      />
      <Block
        position={[0, railHeight + 0.18, 0.11]}
        size={[w - post * 2, 0.075, d - post * 2.4]}
        color={bedding}
      />
      <Block
        position={[0, railHeight + 0.183, -d * 0.25]}
        size={[w - post * 2.1, 0.082, d * 0.22]}
        color="#d7cbb4"
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * (w / 2 - post / 2), h * 0.5, -d / 2 + post / 2]}
            size={[post, h, post]}
            color={darkWalnut}
          />
          <Block
            position={[side * (w / 2 - post / 2), h * 0.29, d / 2 - post / 2]}
            size={[post, h * 0.58, post]}
            color={darkWalnut}
          />
          <mesh
            position={[
              side * (w / 2 - post / 2),
              h + post * 0.12,
              -d / 2 + post / 2,
            ]}
            castShadow
          >
            <sphereGeometry args={[post * 0.65, 12, 8]} />
            <meshStandardMaterial
              color={brass}
              metalness={0.6}
              roughness={0.32}
            />
          </mesh>
          <Block
            position={[side * w * 0.24, railHeight + 0.245, -d * 0.27]}
            size={[w * 0.42, 0.055, d * 0.18]}
            color="#e7dcc9"
          />
          <Block
            position={[side * w * 0.24, railHeight + 0.252, -d * 0.27]}
            size={[w * 0.35, 0.012, d * 0.12]}
            color="#f1e9da"
          />
        </group>
      ))}
      <Block
        position={[0, h * 0.73, -d / 2 + post / 2]}
        size={[w - post, h * 0.42, post * 0.75]}
        color={walnut}
      />
      <Block
        position={[0, h * 0.49, d / 2 - post / 2]}
        size={[w - post, h * 0.17, post * 0.75]}
        color={walnut}
      />
      {[-1, 0, 1].map((panel) => (
        <Block
          key={panel}
          position={[panel * w * 0.29, h * 0.74, -d / 2 + post]}
          size={[w * 0.23, h * 0.27, 0.012]}
          color="#846044"
        />
      ))}
      <Block
        position={[0, railHeight + 0.23, d * 0.29]}
        size={[w - post * 2, 0.075, d * 0.13]}
        color="#ad8a69"
      />
    </group>
  );
}

export function Cabinet({ item }: { item: SceneItem }) {
  const w = item.width;
  const h = item.height;
  const d = item.depth;
  const wood = item.color ?? "#76583f";
  const base = Math.min(0.13, h * 0.12);
  const top = Math.min(0.12, h * 0.1);
  const doorTop = h - top - (h > 1 ? h * 0.17 : 0);
  const doorHeight = doorTop - base;
  return (
    <group>
      <Block
        position={[0, h / 2, 0]}
        size={[w * 0.97, h - base, d * 0.94]}
        color={darkWalnut}
      />
      <Block position={[0, base / 2, 0]} size={[w, base, d]} color={wood} />
      <Block
        position={[0, h - top / 2, 0]}
        size={[w * 1.05, top, d * 1.05]}
        color={wood}
      />
      <Block
        position={[0, h - top - 0.028, d * 0.51]}
        size={[w, 0.035, 0.035]}
        color={brass}
        metalness={0.6}
      />
      {[-1, 1].map((side) => {
        const x = side * w * 0.245;
        return (
          <group key={side}>
            <Block
              position={[x, (base + doorTop) / 2, d * 0.475]}
              size={[w * 0.48, Math.max(0.02, doorHeight - 0.03), 0.045]}
              color={wood}
            />
            <Block
              position={[x, (base + doorTop) / 2, d * 0.503]}
              size={[w * 0.37, Math.max(0.02, doorHeight - 0.16), 0.014]}
              color="#8b6b4d"
            />
            <Block
              position={[x, (base + doorTop) / 2, d * 0.513]}
              size={[w * 0.31, Math.max(0.01, doorHeight - 0.22), 0.008]}
              color={wood}
            />
            <Pin
              position={[side * w * 0.075, (base + doorTop) / 2, d * 0.55]}
              radius={0.02}
              height={0.04}
              color={brass}
              rotation={[Math.PI / 2, 0, 0]}
            />
            {[0.2, 0.75].map((fraction) => (
              <Block
                key={fraction}
                position={[
                  side * w * 0.47,
                  base + (doorTop - base) * fraction,
                  d * 0.51,
                ]}
                size={[0.025, 0.07, 0.03]}
                color={brass}
                metalness={0.6}
              />
            ))}
          </group>
        );
      })}
      {h > 1 && (
        <group>
          <Block
            position={[0, doorTop + (h - top - doorTop) / 2, d * 0.49]}
            size={[w * 0.94, h - top - doorTop - 0.025, 0.05]}
            color={wood}
          />
          {[-1, 1].map((side) => (
            <Pin
              key={side}
              position={[
                side * w * 0.13,
                doorTop + (h - top - doorTop) / 2,
                d * 0.54,
              ]}
              radius={0.013}
              height={0.05}
              color={brass}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
        </group>
      )}
    </group>
  );
}

export function DeskLamp({ item }: { item: SceneItem }) {
  const scale: [number, number, number] = [
    item.width / 0.45,
    item.height / 0.65,
    item.depth / 0.45,
  ];
  const shade = item.color ?? "#476654";
  return (
    <group scale={scale}>
      <Pin
        position={[0, 0.027, 0]}
        radius={0.145}
        height={0.054}
        color={shade}
      />
      <Pin
        position={[0, 0.066, 0]}
        radius={0.07}
        height={0.028}
        color={brass}
      />
      <mesh position={[0, 0.19, 0]} rotation={[0, 0, -0.28]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.25, 10]} />
        <meshStandardMaterial color={brass} metalness={0.68} roughness={0.3} />
      </mesh>
      <mesh position={[0.067, 0.405, 0]} rotation={[0, 0, 0.48]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.27, 10]} />
        <meshStandardMaterial color={brass} metalness={0.68} roughness={0.3} />
      </mesh>
      {[0.18, 0.31].map((y) => (
        <mesh key={y} position={[y === 0.18 ? 0.034 : 0.02, y, 0]} castShadow>
          <sphereGeometry args={[0.025, 12, 8]} />
          <meshStandardMaterial color={darkWalnut} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.52, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.155, 0.19, 24, 1, true]} />
        <meshStandardMaterial
          color={shade}
          side={THREE.DoubleSide}
          roughness={0.46}
          metalness={0.32}
        />
      </mesh>
      <mesh position={[0.12, 0.43, 0]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial
          color="#ffeac0"
          emissive="#ffe1a0"
          emissiveIntensity={0.8}
        />
      </mesh>
      <Pin
        position={[0.12, 0.617, 0]}
        radius={0.024}
        height={0.028}
        color={brass}
      />
    </group>
  );
}

const bars = [
  "#d9d9c9",
  "#d4c45e",
  "#72b5b6",
  "#6fb56f",
  "#a779b3",
  "#b75f5b",
  "#6876b4",
];

export function Monitor({ item }: { item: SceneItem }) {
  const w = item.width;
  const h = item.height;
  const d = item.depth;
  const screenH = h * 0.65;
  const screenY = h * 0.65;
  const casing = item.color ?? "#242727";
  return (
    <group>
      <Block
        position={[0, 0.018, 0]}
        size={[w * 0.36, 0.036, d * 0.75]}
        color="#393b3a"
      />
      <Block
        position={[0, h * 0.18, 0]}
        size={[w * 0.055, h * 0.3, d * 0.17]}
        color="#4b4e4c"
      />
      <Block
        position={[0, screenY, 0]}
        size={[w, screenH, d * 0.62]}
        color={casing}
      />
      <Block
        position={[0, screenY, d * 0.32]}
        size={[w * 0.93, screenH * 0.86, 0.012]}
        color="#101a1c"
      />
      {bars.map((color, index) => (
        <Block
          key={color}
          position={[(index - 3) * w * 0.132, screenY, d * 0.332]}
          size={[w * 0.132, screenH * 0.77, 0.004]}
          color={color}
        />
      ))}
      <Block
        position={[0, screenY + screenH * 0.48, d * 0.32]}
        size={[w * 0.96, 0.015, 0.022]}
        color="#67655a"
      />
      <mesh position={[w * 0.42, screenY - screenH * 0.46, d * 0.324]}>
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshStandardMaterial
          color="#79bb8b"
          emissive="#5ca777"
          emissiveIntensity={0.55}
        />
      </mesh>
      {[-1, 0, 1].map((index) => (
        <Block
          key={index}
          position={[index * w * 0.12, screenY, -d * 0.315]}
          size={[w * 0.065, screenH * 0.6, 0.006]}
          color="#404544"
        />
      ))}
    </group>
  );
}
