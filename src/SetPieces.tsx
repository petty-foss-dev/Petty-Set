import { Component, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import type { MannequinJoints, SceneItem } from "./model";
import Mannequin from "./Mannequin";
import { Bench, Tree, Vehicle } from "./OutdoorAssets";
import { Barrel, Facade, Streetlamp, Surface } from "./BacklotAssets";
import PowerSource from "./PowerSource";

const ImportedAsset = lazy(() => import("./ImportedAsset"));

class AssetBoundary extends Component<
  { children: ReactNode; item: SceneItem },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <Box
          position={[0, this.props.item.height / 2, 0]}
          size={[
            this.props.item.width,
            this.props.item.height,
            this.props.item.depth,
          ]}
          color="#a99576"
        />
      );
    return this.props.children;
  }
}

const wood = "#8b6548";
const darkWood = "#634b3a";
const linen = "#a9a696";
const metal = "#343a3a";

function Box({
  position,
  size,
  color,
  roughness = 0.82,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function Rod({
  from,
  to,
  radius,
  color,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: string;
}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return (
    <mesh
      position={a.add(b).multiplyScalar(0.5)}
      quaternion={rotation}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, direction.length(), 10]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}

function Wall({ item }: { item: SceneItem }) {
  const o = item.opening;
  const w = item.width;
  const h = item.height;
  const d = item.depth;
  const plaster = "#c5c3b3";
  const trim = "#e2dac6";
  if (!o)
    return (
      <group>
        <Box position={[0, h / 2, 0]} size={[w, h, d]} color={plaster} />
        <Box
          position={[0, 0.08, d / 2 + 0.013]}
          size={[w, 0.16, 0.028]}
          color={trim}
        />
        <Box
          position={[0, 0.08, -d / 2 - 0.013]}
          size={[w, 0.16, 0.028]}
          color={trim}
        />
      </group>
    );
  const ow = Math.min(o.width, w - 0.12);
  const cx = THREE.MathUtils.clamp(o.offset, -w / 2 + ow / 2, w / 2 - ow / 2);
  const left = cx - ow / 2;
  const right = cx + ow / 2;
  const sill =
    o.type === "door" ? 0 : THREE.MathUtils.clamp(o.sill, 0, h - 0.1);
  const oh = Math.min(o.height, h - sill);
  const cap = h - sill - oh;
  const frame = 0.075;
  return (
    <group>
      {left + w / 2 > 0.01 && (
        <Box
          position={[(left - w / 2) / 2, h / 2, 0]}
          size={[left + w / 2, h, d]}
          color={plaster}
        />
      )}
      {w / 2 - right > 0.01 && (
        <Box
          position={[(right + w / 2) / 2, h / 2, 0]}
          size={[w / 2 - right, h, d]}
          color={plaster}
        />
      )}
      {sill > 0.01 && (
        <Box
          position={[cx, sill / 2, 0]}
          size={[ow, sill, d]}
          color={plaster}
        />
      )}
      {cap > 0.01 && (
        <Box
          position={[cx, sill + oh + cap / 2, 0]}
          size={[ow, cap, d]}
          color={plaster}
        />
      )}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (d / 2 + 0.018)]}>
          <Box
            position={[left - frame / 2, sill + oh / 2, 0]}
            size={[frame, oh + frame * 2, 0.035]}
            color={trim}
          />
          <Box
            position={[right + frame / 2, sill + oh / 2, 0]}
            size={[frame, oh + frame * 2, 0.035]}
            color={trim}
          />
          <Box
            position={[cx, sill + oh + frame / 2, 0]}
            size={[ow + frame * 2, frame, 0.035]}
            color={trim}
          />
          {o.type === "window" && (
            <Box
              position={[cx, sill - frame / 2, 0]}
              size={[ow + frame * 2, frame, 0.08]}
              color={trim}
            />
          )}
          <Box
            position={[-w / 2 + (left + w / 2) / 2, 0.08, 0]}
            size={[left + w / 2, 0.16, 0.03]}
            color={trim}
          />
          <Box
            position={[right + (w / 2 - right) / 2, 0.08, 0]}
            size={[w / 2 - right, 0.16, 0.03]}
            color={trim}
          />
        </group>
      ))}
      {o.type === "window" && (
        <group>
          <Box
            position={[cx, sill + oh / 2, 0]}
            size={[ow - 0.08, oh - 0.08, 0.012]}
            color="#a7c4bd"
            roughness={0.12}
          />
          <Box
            position={[cx, sill + oh / 2, d / 2 + 0.04]}
            size={[0.045, oh, 0.045]}
            color={trim}
          />
          <Box
            position={[cx, sill + oh / 2, -d / 2 - 0.04]}
            size={[0.045, oh, 0.045]}
            color={trim}
          />
          <Box
            position={[cx, sill + oh / 2, d / 2 + 0.04]}
            size={[ow, 0.045, 0.045]}
            color={trim}
          />
          <Box
            position={[cx, sill + oh / 2, -d / 2 - 0.04]}
            size={[ow, 0.045, 0.045]}
            color={trim}
          />
        </group>
      )}
      {o.type === "door" && ow <= 1.6 && (
        <group rotation={[0, -0.55, 0]} position={[left, 0, 0]}>
          <Box
            position={[ow / 2 - 0.04, oh / 2, 0]}
            size={[ow - 0.08, oh - 0.06, 0.045]}
            color="#957960"
          />
          <Box
            position={[ow / 2 - 0.04, oh / 2, 0.028]}
            size={[ow - 0.28, oh - 0.32, 0.012]}
            color="#ad8d6e"
          />
          <mesh position={[ow - 0.19, oh / 2, 0.065]}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshStandardMaterial color="#bd9d62" metalness={0.7} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Table({ item }: { item: SceneItem }) {
  const { width: w, height: h, depth: d } = item;
  return (
    <group>
      <Box position={[0, h - 0.045, 0]} size={[w, 0.09, d]} color={wood} />
      <Box
        position={[0, h - 0.13, 0]}
        size={[w - 0.17, 0.12, d - 0.17]}
        color={darkWood}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}${z}`}
            position={[x * (w / 2 - 0.13), (h - 0.12) / 2, z * (d / 2 - 0.13)]}
            size={[0.085, h - 0.12, 0.085]}
            color={darkWood}
          />
        )),
      )}
      <mesh position={[0.18, h + 0.025, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
        <meshStandardMaterial color="#d5cbb4" />
      </mesh>
      <Box
        position={[-0.23, h + 0.017, 0.05]}
        size={[0.26, 0.035, 0.19]}
        color="#c0b193"
      />
      <Box
        position={[0, h - 0.035, d / 2 - 0.015]}
        size={[w - 0.08, 0.014, 0.018]}
        color="#b8895b"
      />
      {[-1, 1].map((side) => (
        <Rod
          key={side}
          from={[side * (w / 2 - 0.13), h - 0.18, -d / 2 + 0.13]}
          to={[side * (w / 2 - 0.13), h - 0.18, d / 2 - 0.13]}
          radius={0.013}
          color="#a77952"
        />
      ))}
    </group>
  );
}

function Chair({ item }: { item: SceneItem }) {
  const w = item.width,
    d = item.depth;
  return (
    <group>
      <Box position={[0, 0.44, 0]} size={[w, 0.12, d]} color={wood} />
      <Box
        position={[0, 0.72, -d / 2 + 0.05]}
        size={[w, 0.52, 0.1]}
        color={wood}
      />
      <Box
        position={[0, 0.51, 0]}
        size={[w - 0.08, 0.09, d - 0.09]}
        color={linen}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}${z}`}
            position={[x * (w / 2 - 0.075), 0.22, z * (d / 2 - 0.075)]}
            size={[0.055, 0.44, 0.055]}
            color={darkWood}
          />
        )),
      )}
    </group>
  );
}

function Sofa({ item }: { item: SceneItem }) {
  const w = item.width,
    d = item.depth;
  return (
    <group>
      <Box position={[0, 0.3, 0]} size={[w, 0.36, d]} color="#716f62" />
      <Box
        position={[0, 0.67, -d / 2 + 0.1]}
        size={[w, 0.36, 0.2]}
        color={linen}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[side * (w / 2 - 0.11), 0.55, 0]}
            size={[0.22, 0.38, d]}
            color={linen}
          />
          <Box
            position={[side * (w / 4), 0.53, 0.08]}
            size={[w / 2 - 0.17, 0.16, d - 0.3]}
            color="#d2cdb8"
          />
          <Box
            position={[side * (w / 2 - 0.18), 0.085, 0.3]}
            size={[0.09, 0.17, 0.09]}
            color={darkWood}
          />
        </group>
      ))}
    </group>
  );
}

function Shelf({ item }: { item: SceneItem }) {
  const w = item.width,
    h = item.height,
    d = item.depth;
  return (
    <group>
      {[-1, 1].map((x) => (
        <Box
          key={x}
          position={[x * (w / 2 - 0.04), h / 2, 0]}
          size={[0.08, h, d]}
          color={darkWood}
        />
      ))}
      {[0.06, 0.48, 0.9, 1.32, 1.74]
        .filter((y) => y < h)
        .map((y) => (
          <Box key={y} position={[0, y, 0]} size={[w, 0.07, d]} color={wood} />
        ))}
      {[0.48, 0.9, 1.32]
        .filter((y) => y < h)
        .map((y, row) =>
          Array.from({ length: 9 }, (_, i) => (
            <Box
              key={`${row}-${i}`}
              position={[-w / 2 + 0.2 + (i * (w - 0.3)) / 9, y + 0.17, -0.03]}
              size={[0.09 + (i % 3) * 0.017, 0.26 + (i % 2) * 0.08, d * 0.62]}
              color={["#9d7358", "#c8b492", "#67746b", "#b98e65"][i % 4]}
            />
          )),
        )}
    </group>
  );
}

function Plant({ item }: { item: SceneItem }) {
  const h = item.height;
  return (
    <group>
      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.13, 0.46, 12]} />
        <meshStandardMaterial color="#9c8065" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <torusGeometry args={[0.165, 0.021, 7, 16]} />
        <meshStandardMaterial color="#c5a386" roughness={0.9} />
      </mesh>
      <Rod
        from={[0, 0.45, 0]}
        to={[0, h - 0.22, 0]}
        radius={0.035}
        color={darkWood}
      />
      {Array.from({ length: 7 }, (_, i) => {
        const a = i * 2.4;
        const y = 0.75 + (i * (h - 0.95)) / 7;
        const r = 0.32 + (i % 3) * 0.07;
        return (
          <group key={i}>
            <Rod
              from={[0, y, 0]}
              to={[Math.cos(a) * r, y + 0.12, Math.sin(a) * r]}
              radius={0.018}
              color={darkWood}
            />
            <mesh
              position={[Math.cos(a) * r, y + 0.13, Math.sin(a) * r]}
              rotation={[0, -a, -0.35]}
              castShadow
            >
              <sphereGeometry args={[0.24, 9, 7]} />
              <meshStandardMaterial
                color={i % 2 ? "#637c5c" : "#738e65"}
                roughness={0.95}
              />
            </mesh>
            <mesh
              position={[
                Math.cos(a + 0.36) * r * 0.78,
                y + 0.24,
                Math.sin(a + 0.36) * r * 0.78,
              ]}
              rotation={[0, -a - 0.36, -0.55]}
              castShadow
            >
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color="#82946d" roughness={0.96} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Camera({ item }: { item: SceneItem }) {
  const h = item.height;
  const body = item.cameraBody ?? "cinema";
  const bodySize: [number, number, number] =
    body === "broadcast"
      ? [0.66, 0.38, 0.55]
      : body === "mirrorless"
        ? [0.34, 0.24, 0.23]
        : [0.48, 0.32, 0.35];
  const lensLength =
    body === "broadcast" ? 0.48 : body === "mirrorless" ? 0.2 : 0.35;
  return (
    <group>
      {Array.from({ length: 3 }, (_, i) => {
        const a = (i * Math.PI * 2) / 3;
        return (
          <Rod
            key={i}
            from={[0, h - 0.2, 0]}
            to={[Math.sin(a) * 0.48, 0.04, Math.cos(a) * 0.48]}
            radius={0.025}
            color={metal}
          />
        );
      })}
      <Box
        position={[0, h - 0.18, 0]}
        size={[0.36, 0.07, 0.28]}
        color={metal}
      />
      <Box position={[0, h + 0.08, 0]} size={bodySize} color="#282b2b" />
      <Box
        position={[0, h + 0.08, bodySize[2] / 2 + 0.006]}
        size={[bodySize[0] * 0.63, bodySize[1] * 0.48, 0.012]}
        color="#58665e"
      />
      {body !== "mirrorless" && (
        <Box
          position={[0, h + 0.25, 0.07]}
          size={[0.3, 0.07, 0.17]}
          color={metal}
        />
      )}
      {body === "mirrorless" && (
        <Box
          position={[0, h + 0.22, 0.04]}
          size={[0.13, 0.08, 0.13]}
          color={metal}
        />
      )}
      {body === "broadcast" && (
        <Box
          position={[0, h + 0.27, 0.32]}
          size={[0.27, 0.1, 0.22]}
          color="#1e2425"
        />
      )}
      <mesh
        position={[0, h + 0.07, -(bodySize[2] / 2 + lensLength / 2)]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.13, 0.16, lensLength, 20]} />
        <meshStandardMaterial color="#202424" roughness={0.45} />
      </mesh>
      <mesh
        position={[0, h + 0.07, -(bodySize[2] / 2 + lensLength * 0.62)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.164, 0.164, 0.025, 20]} />
        <meshStandardMaterial
          color="#4d5350"
          metalness={0.6}
          roughness={0.38}
        />
      </mesh>
      <mesh
        position={[0, h + 0.07, -(bodySize[2] / 2 + lensLength)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.11, 20]} />
        <meshStandardMaterial
          color="#3c666b"
          metalness={0.45}
          roughness={0.15}
        />
      </mesh>
      {body !== "mirrorless" && (
        <Box
          position={[bodySize[0] / 2 + 0.04, h + 0.12, 0.07]}
          size={[0.12, 0.22, 0.24]}
          color="#1e2425"
        />
      )}
    </group>
  );
}

function Light({ item }: { item: SceneItem }) {
  const h = item.height;
  const fixture = item.lightType ?? "softbox";
  return (
    <group>
      {Array.from({ length: 3 }, (_, i) => {
        const a = (i * Math.PI * 2) / 3;
        return (
          <Rod
            key={i}
            from={[0, 0.75, 0]}
            to={[Math.sin(a) * 0.43, 0.035, Math.cos(a) * 0.43]}
            radius={0.02}
            color={metal}
          />
        );
      })}
      <Rod from={[0, 0.3, 0]} to={[0, h, 0]} radius={0.025} color={metal} />
      <Box
        position={[0, h * 0.55, 0]}
        size={[0.12, 0.1, 0.12]}
        color="#77746b"
      />
      <group
        position={[0, h, 0]}
        rotation={[
          fixture === "practical" ? 0 : -((item.tilt ?? 45) * Math.PI) / 180,
          0,
          0,
        ]}
      >
        <Box position={[0, 0, 0]} size={[0.42, 0.36, 0.3]} color="#303739" />
        {fixture === "softbox" ? (
          <>
            <Box
              position={[0, 0, -0.22]}
              size={[0.72, 0.62, 0.1]}
              color="#242b2d"
            />
            <Box
              position={[0, 0, -0.278]}
              size={[0.59, 0.49, 0.012]}
              color={item.color ?? "#fff3d6"}
              roughness={0.3}
            />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                position={[side * 0.36, 0, -0.31]}
                size={[0.03, 0.57, 0.25]}
                color="#252a2a"
              />
            ))}
          </>
        ) : fixture === "spot" ? (
          <mesh
            position={[0, 0, -0.22]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <coneGeometry args={[0.25, 0.4, 16]} />
            <meshStandardMaterial color="#2d3435" />
          </mesh>
        ) : (
          <mesh position={[0, 0, -0.1]} castShadow>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshStandardMaterial
              color={item.color ?? "#fff3d6"}
              emissive={item.color ?? "#fff3d6"}
              emissiveIntensity={0.5}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

export default function SetPiece({
  item,
  actorJoints,
  walkPhase,
}: {
  item: SceneItem;
  actorJoints?: MannequinJoints;
  walkPhase?: number;
}) {
  switch (item.kind) {
    case "wall":
      return <Wall item={item} />;
    case "actor":
      return (
        <Mannequin item={item} joints={actorJoints} walkPhase={walkPhase} />
      );
    case "tree":
      return <Tree item={item} />;
    case "bench":
      return <Bench item={item} />;
    case "vehicle":
      return <Vehicle item={item} />;
    case "facade":
      return <Facade item={item} />;
    case "streetlamp":
      return <Streetlamp item={item} />;
    case "barrel":
      return <Barrel item={item} />;
    case "ground":
      return <Surface item={item} />;
    case "table":
      return <Table item={item} />;
    case "chair":
      return <Chair item={item} />;
    case "sofa":
      return <Sofa item={item} />;
    case "shelf":
      return <Shelf item={item} />;
    case "plant":
      return <Plant item={item} />;
    case "camera":
      return <Camera item={item} />;
    case "light":
      return <Light item={item} />;
    case "power":
      return <PowerSource item={item} />;
    case "asset":
      return (
        <AssetBoundary item={item}>
          <Suspense
            fallback={
              <Box
                position={[0, item.height / 2, 0]}
                size={[item.width, item.height, item.depth]}
                color="#a99576"
              />
            }
          >
            <ImportedAsset item={item} />
          </Suspense>
        </AssetBoundary>
      );
    case "rug":
      return (
        <group>
          <Box
            position={[0, 0.012, 0]}
            size={[item.width, 0.025, item.depth]}
            color="#786c5c"
          />
          <Box
            position={[0, 0.03, 0]}
            size={[item.width - 0.14, 0.007, item.depth - 0.14]}
            color="#ab9a78"
          />
          <Box
            position={[0, 0.035, 0]}
            size={[item.width - 0.34, 0.007, item.depth - 0.34]}
            color="#8b806d"
          />
        </group>
      );
    case "box":
      return (
        <Box
          position={[0, item.height / 2, 0]}
          size={[item.width, item.height, item.depth]}
          color="#ad987d"
        />
      );
  }
}
