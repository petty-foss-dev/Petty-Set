import type { SceneItem } from "./model";

export default function PowerSource({ item }: { item: SceneItem }) {
  return (
    <group scale={[item.width / 0.52, item.height / 0.585, item.depth / 0.38]}>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.06, 0.38]} />
        <meshStandardMaterial color="#292c2a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.29, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.48, 0.3]} />
        <meshStandardMaterial
          color="#484c49"
          roughness={0.72}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.29, 0.154]}>
        <boxGeometry args={[0.4, 0.41, 0.012]} />
        <meshStandardMaterial color="#d59a4d" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.43, 0.164]}>
        <boxGeometry args={[0.31, 0.045, 0.008]} />
        <meshBasicMaterial color="#302c27" />
      </mesh>
      {[-0.11, 0, 0.11].map((x) => (
        <group key={x} position={[x, 0.26, 0.17]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.034, 0.034, 0.012, 16]} />
            <meshStandardMaterial color="#292c2a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <boxGeometry args={[0.012, 0.025, 0.004]} />
            <meshBasicMaterial color="#d9b27e" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.56, 0]} castShadow>
        <boxGeometry args={[0.2, 0.045, 0.07]} />
        <meshStandardMaterial color="#292c2a" roughness={0.8} />
      </mesh>
    </group>
  );
}
