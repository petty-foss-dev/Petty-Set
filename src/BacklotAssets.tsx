import { useEffect, useMemo } from "react";
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
        roughness={metalness ? 0.42 : 0.88}
        metalness={metalness}
      />
    </mesh>
  );
}

export function Facade({ item }: { item: SceneItem }) {
  const w = item.width,
    h = item.height,
    d = item.depth;
  const style = item.facadeStyle ?? "storefront";
  const paint =
    item.color ??
    (style === "brick"
      ? "#9d715e"
      : style === "theater"
        ? "#c4ad88"
        : "#c5ae83");
  const trim = style === "brick" ? "#e5d1b4" : "#f0dec0";
  const front = d / 2 + 0.018;
  const opening = Math.min(w * 0.32, 1.12);
  const signTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;
    const context = canvas.getContext("2d")!;
    context.fillStyle = style === "theater" ? "#f7dfa9" : "#f2e7d1";
    context.font = "bold 94px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const label =
      item.signText ??
      (style === "brick"
        ? "APARTMENTS"
        : style === "theater"
          ? "PICTURE HOUSE"
          : "MARKET");
    const measured = context.measureText(label).width;
    if (measured > 930)
      context.font = `bold ${Math.floor((94 * 930) / measured)}px sans-serif`;
    context.fillText(label, 512, 100);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [item.signText, style]);
  useEffect(() => () => signTexture.dispose(), [signTexture]);
  return (
    <group>
      <Block position={[0, h / 2, 0]} size={[w, h, d]} color={paint} />
      <Block
        position={[0, h - 0.12, front + 0.05]}
        size={[w + 0.12, 0.24, 0.18]}
        color={trim}
      />
      <Block
        position={[0, h - 0.39, front + 0.025]}
        size={[w + 0.06, 0.08, 0.12]}
        color="#785743"
      />
      <Block
        position={[0, 0.13, front + 0.04]}
        size={[w + 0.08, 0.26, 0.13]}
        color="#6b5a4d"
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * (w / 2 - 0.12), h / 2, front + 0.02]}
            size={[0.14, h - 0.4, 0.09]}
            color={trim}
          />
          <Block
            position={[side * (w * 0.31), h * 0.49, front + 0.04]}
            size={[w * 0.25, h * 0.38, 0.035]}
            color="#54696b"
            metalness={0.12}
          />
          <Block
            position={[side * (w * 0.31), h * 0.49, front + 0.068]}
            size={[w * 0.25 + 0.09, 0.07, 0.06]}
            color={trim}
          />
          <Block
            position={[side * (w * 0.31), h * 0.49, front + 0.068]}
            size={[0.065, h * 0.38 + 0.08, 0.06]}
            color={trim}
          />
          <Block
            position={[side * (w * 0.31), h * 0.29, front + 0.11]}
            size={[w * 0.28, 0.1, 0.18]}
            color={trim}
          />
          <Block
            position={[side * (w * 0.31), h * 0.78, front + 0.04]}
            size={[w * 0.24, h * 0.19, 0.035]}
            color="#566763"
          />
          <Block
            position={[side * (w * 0.31), h * 0.78, front + 0.075]}
            size={[0.06, h * 0.2, 0.045]}
            color={trim}
          />
        </group>
      ))}
      <Block
        position={[0, h * 0.37, front + 0.045]}
        size={[opening, h * 0.65, 0.055]}
        color={style === "theater" ? "#713f3e" : "#76573e"}
      />
      <Block
        position={[0, h * 0.37, front + 0.09]}
        size={[opening - 0.2, h * 0.52, 0.012]}
        color={style === "theater" ? "#975751" : "#9c7955"}
      />
      <mesh position={[opening * 0.36, h * 0.35, front + 0.13]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color="#d1a95c" metalness={0.7} roughness={0.3} />
      </mesh>
      {style === "storefront" && (
        <>
          <Block
            position={[0, h * 0.72, front + 0.32]}
            size={[w * 0.86, 0.08, 0.72]}
            color="#744d38"
          />
          <Block
            position={[0, h * 0.7, front + 0.32]}
            size={[w * 0.85, 0.05, 0.68]}
            color="#bd8052"
          />
          {[-0.3, 0, 0.3].map((x) => (
            <Block
              key={x}
              position={[x * w, h * 0.69, front + 0.68]}
              size={[0.07, 0.13, 0.045]}
              color="#f0d9af"
            />
          ))}
        </>
      )}
      {style === "brick" &&
        Array.from({ length: 5 }, (_, row) => (
          <group key={row}>
            <Block
              position={[0, h * (0.12 + row * 0.17), front + 0.01]}
              size={[w - 0.2, 0.025, 0.018]}
              color="#bd9880"
            />
            {[-0.42, 0.42].map((x) => (
              <Block
                key={x}
                position={[x * w, h * (0.2 + row * 0.17), front + 0.01]}
                size={[0.025, h * 0.16, 0.018]}
                color="#bd9880"
              />
            ))}
          </group>
        ))}
      {style === "theater" && (
        <>
          <Block
            position={[0, h * 0.71, front + 0.34]}
            size={[w * 0.82, 0.24, 0.65]}
            color="#8a4740"
          />
          {Array.from({ length: 7 }, (_, n) => (
            <mesh
              key={n}
              position={[(n - 3) * w * 0.105, h * 0.71, front + 0.68]}
            >
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial
                color="#ffe3a2"
                emissive="#ffb956"
                emissiveIntensity={0.8}
              />
            </mesh>
          ))}
          <Block
            position={[0, h * 0.87, front + 0.09]}
            size={[w * 0.5, 0.22, 0.12]}
            color="#8a4740"
          />
        </>
      )}
      <mesh
        position={[
          0,
          style === "theater" ? h * 0.87 : h * 0.9,
          front + (style === "theater" ? 0.17 : 0.11),
        ]}
      >
        <planeGeometry
          args={[style === "theater" ? w * 0.47 : w * 0.72, h * 0.13]}
        />
        <meshBasicMaterial map={signTexture} transparent depthWrite={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            position={[side * w * 0.36, h * 0.44, -d / 2 - 0.28]}
            size={[0.07, h * 0.88, 0.07]}
            color="#625747"
          />
          <Block
            position={[side * w * 0.36, h * 0.22, -d / 2 - 0.16]}
            size={[0.07, h * 0.5, 0.07]}
            color="#625747"
          />
        </group>
      ))}
    </group>
  );
}

export function Surface({ item }: { item: SceneItem }) {
  const { width: w, height: h, depth: d } = item;
  const style = item.surfaceStyle ?? "plain";
  return (
    <group>
      <Block
        position={[0, h / 2, 0]}
        size={[w, h, d]}
        color={item.color ?? "#c3bca9"}
      />
      {style === "road" &&
        Array.from({ length: Math.floor(d / 1.7) }, (_, index) => (
          <Block
            key={index}
            position={[0, h + 0.003, -d / 2 + 1 + index * 1.7]}
            size={[0.1, 0.005, 0.84]}
            color="#d3bb87"
          />
        ))}
      {style === "sidewalk" && (
        <>
          <Block
            position={[0, h + 0.065, d / 2 - 0.075]}
            size={[w, 0.13, 0.15]}
            color="#d7c9ad"
          />
          {Array.from({ length: Math.floor(w / 0.7) }, (_, index) => (
            <Block
              key={index}
              position={[-w / 2 + (index + 1) * 0.7, h + 0.004, 0]}
              size={[0.012, 0.005, d - 0.24]}
              color="#948977"
            />
          ))}
          <Block
            position={[0, h + 0.004, -d * 0.08]}
            size={[w, 0.005, 0.012]}
            color="#948977"
          />
        </>
      )}
    </group>
  );
}

export function Streetlamp({ item }: { item: SceneItem }) {
  const h = item.height;
  const r = item.width * 0.36;
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.85, r, 0.08, 12]} />
        <meshStandardMaterial
          color="#292f2b"
          metalness={0.52}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[r * 0.72, r, 0.24, 12]} />
        <meshStandardMaterial
          color="#343a34"
          metalness={0.48}
          roughness={0.5}
        />
      </mesh>
      <Block
        position={[0, h * 0.48, 0]}
        size={[0.16, h * 0.88, 0.16]}
        color="#272e2b"
      />
      {[0.29, 0.72].map((fraction) => (
        <mesh key={fraction} position={[0, h * fraction, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.055, 12]} />
          <meshStandardMaterial
            color="#a58a60"
            metalness={0.55}
            roughness={0.5}
          />
        </mesh>
      ))}
      <mesh position={[0, h * 0.91, 0]} castShadow>
        <cylinderGeometry args={[r * 0.78, r * 0.42, h * 0.13, 4]} />
        <meshStandardMaterial
          color="#ebc684"
          emissive="#f0b66a"
          emissiveIntensity={0.95}
        />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Block
            key={`${x}-${z}`}
            position={[x * r * 0.37, h * 0.91, z * r * 0.37]}
            size={[0.024, h * 0.14, 0.024]}
            color="#303831"
            metalness={0.5}
          />
        )),
      )}
      <mesh position={[0, h * 0.99, 0]} castShadow>
        <coneGeometry args={[r * 0.92, h * 0.12, 4]} />
        <meshStandardMaterial
          color="#343a34"
          metalness={0.48}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, h * 1.05, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color="#c6a365" metalness={0.7} />
      </mesh>
    </group>
  );
}

export function Barrel({ item }: { item: SceneItem }) {
  const h = item.height,
    r = item.width / 2;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.86, r * 0.86, h, 12]} />
        <meshStandardMaterial color={item.color ?? "#98663f"} roughness={0.9} />
      </mesh>
      {[0.12, 0.5, 0.88].map((fraction) => (
        <mesh key={fraction} position={[0, h * fraction, 0]} castShadow>
          <cylinderGeometry args={[r * 0.91, r * 0.91, 0.065, 12]} />
          <meshStandardMaterial
            color="#50534d"
            metalness={0.54}
            roughness={0.55}
          />
        </mesh>
      ))}
      <mesh position={[0, h + 0.005, 0]} castShadow>
        <cylinderGeometry args={[r * 0.91, r * 0.91, 0.035, 12]} />
        <meshStandardMaterial
          color="#50534d"
          metalness={0.54}
          roughness={0.55}
        />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh
          key={index}
          position={[
            Math.sin((index * Math.PI) / 6) * r * 0.87,
            h / 2,
            Math.cos((index * Math.PI) / 6) * r * 0.87,
          ]}
          rotation={[0, (index * Math.PI) / 6, 0]}
        >
          <boxGeometry args={[0.018, h * 0.74, 0.018]} />
          <meshStandardMaterial color="#65482f" />
        </mesh>
      ))}
      <mesh position={[0, h + 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.83, 12]} />
        <meshStandardMaterial color="#765235" />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index * Math.PI) / 3;
        return (
          <mesh
            key={index}
            position={[
              Math.sin(angle) * r * 0.7,
              h + 0.03,
              Math.cos(angle) * r * 0.7,
            ]}
          >
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshStandardMaterial
              color="#ada388"
              metalness={0.65}
              roughness={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}
