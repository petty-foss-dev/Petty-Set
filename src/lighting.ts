import { wallEndpoints, wallOpenings } from "./model.ts";
import type { SceneItem } from "./model.ts";

export type LightPoint = { x: number; z: number };

export function fixtureLumens(light: SceneItem) {
  return light.lumens ?? (light.intensity ?? 2) * 600;
}

export function lightDirection(light: SceneItem) {
  const yaw = (light.rotation * Math.PI) / 180;
  const tilt = ((light.tilt ?? 45) * Math.PI) / 180;
  return {
    x: -Math.sin(yaw) * Math.cos(tilt),
    y: -Math.sin(tilt),
    z: -Math.cos(yaw) * Math.cos(tilt),
  };
}

export function lightAimPoint(light: SceneItem): LightPoint {
  if (light.lightType === "practical") return { x: light.x, z: light.z };
  const direction = lightDirection(light);
  const distance = (light.y + light.height) / Math.max(0.087, -direction.y);
  return {
    x: light.x + direction.x * distance,
    z: light.z + direction.z * distance,
  };
}

function wallBlocksRay(light: SceneItem, point: LightPoint, wall: SceneItem) {
  const [a, b] = wallEndpoints(wall);
  const rayX = point.x - light.x;
  const rayZ = point.z - light.z;
  const wallX = b.x - a.x;
  const wallZ = b.z - a.z;
  const denominator = rayX * wallZ - rayZ * wallX;
  if (Math.abs(denominator) < 1e-8) return false;
  const deltaX = a.x - light.x;
  const deltaZ = a.z - light.z;
  const rayFraction = (deltaX * wallZ - deltaZ * wallX) / denominator;
  const wallFraction = (deltaX * rayZ - deltaZ * rayX) / denominator;
  if (
    rayFraction <= 0.001 ||
    rayFraction >= 0.999 ||
    wallFraction < 0 ||
    wallFraction > 1
  )
    return false;
  const height = light.y + light.height;
  const crossingHeight = height * (1 - rayFraction);
  if (crossingHeight < wall.y || crossingHeight > wall.y + wall.height)
    return false;
  for (const opening of wallOpenings(wall)) {
    const wallPosition = (wallFraction - 0.5) * wall.width;
    const withinWidth =
      Math.abs(wallPosition - opening.offset) < opening.width / 2;
    const withinHeight =
      crossingHeight > wall.y + opening.sill &&
      crossingHeight < wall.y + opening.sill + opening.height;
    if (withinWidth && withinHeight) return false;
  }
  return true;
}

export function floorIlluminance(
  light: SceneItem,
  point: LightPoint,
  walls: SceneItem[],
) {
  if (light.kind !== "light" || light.hidden || fixtureLumens(light) <= 0)
    return 0;
  const height = light.y + light.height;
  if (height <= 0) return 0;
  const dx = point.x - light.x;
  const dz = point.z - light.z;
  const distanceSquared = dx * dx + dz * dz + height * height;
  const distance = Math.sqrt(distanceSquared);
  const cosineFloor = height / distance;
  let candela: number;
  let falloff = 1;
  if (light.lightType === "practical") {
    candela = fixtureLumens(light) / (4 * Math.PI);
  } else {
    const halfAngle =
      (Math.min(80, Math.max(2.5, (light.spread ?? 45) / 2)) * Math.PI) / 180;
    const direction = lightDirection(light);
    const cosineBeam =
      (direction.x * dx - direction.y * height + direction.z * dz) / distance;
    const beamAngle = Math.acos(Math.min(1, Math.max(-1, cosineBeam)));
    if (beamAngle >= halfAngle) return 0;
    falloff = Math.min(1, (halfAngle - beamAngle) / (halfAngle * 0.18));
    candela = fixtureLumens(light) / (2 * Math.PI * (1 - Math.cos(halfAngle)));
  }
  if (walls.some((wall) => !wall.hidden && wallBlocksRay(light, point, wall)))
    return 0;
  return (candela * cosineFloor * falloff) / distanceSquared;
}

export function sampleFloorIlluminance(items: SceneItem[], point: LightPoint) {
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const contributors = items
    .filter((item) => item.kind === "light" && !item.hidden)
    .map((light) => ({
      id: light.id,
      name: light.name,
      lux: floorIlluminance(light, point, walls),
    }))
    .sort((a, b) => b.lux - a.lux);
  return {
    total: contributors.reduce((sum, light) => sum + light.lux, 0),
    contributors,
  };
}

export function traceFloor(items: SceneItem[], step = 0.25) {
  const lights = items.filter((item) => item.kind === "light" && !item.hidden);
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const points = [
    ...walls.flatMap(wallEndpoints),
    ...lights.map((item) => ({ x: item.x, z: item.z })),
  ];
  if (!lights.length || !points.length) return null;
  const minX = Math.min(...points.map((point) => point.x)) - 2;
  const maxX = Math.max(...points.map((point) => point.x)) + 2;
  const minZ = Math.min(...points.map((point) => point.z)) - 2;
  const maxZ = Math.max(...points.map((point) => point.z)) + 2;
  const width = Math.min(160, Math.max(1, Math.ceil((maxX - minX) / step)));
  const height = Math.min(160, Math.max(1, Math.ceil((maxZ - minZ) / step)));
  const values = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const point = {
        x: minX + ((column + 0.5) * (maxX - minX)) / width,
        z: minZ + ((row + 0.5) * (maxZ - minZ)) / height,
      };
      values[row * width + column] = lights.reduce(
        (total, light) => total + floorIlluminance(light, point, walls),
        0,
      );
    }
  }
  return {
    minX,
    minZ,
    width,
    height,
    worldWidth: maxX - minX,
    worldHeight: maxZ - minZ,
    values,
  };
}
