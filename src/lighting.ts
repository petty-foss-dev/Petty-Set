import { wallEndpoints, wallOpenings } from "./model.ts";
import type { SceneItem } from "./model.ts";

export type LightPoint = { x: number; z: number };

type Occluder = {
  id: string;
  x: number;
  y: number;
  z: number;
  halfWidth: number;
  height: number;
  halfDepth: number;
  cosine: number;
  sine: number;
};

const solidKinds = new Set<SceneItem["kind"]>([
  "actor",
  "box",
  "sofa",
  "shelf",
  "bed",
  "cabinet",
  "monitor",
  "vehicle",
  "facade",
  "barrel",
  "asset",
]);

function prepareOccluders(items: SceneItem[]): Occluder[] {
  return items
    .filter((item) => solidKinds.has(item.kind) && !item.hidden)
    .map((item) => {
      const yaw = (item.rotation * Math.PI) / 180;
      return {
        id: item.id,
        x: item.x,
        y: item.y,
        z: item.z,
        halfWidth: item.width / 2,
        height: item.height,
        halfDepth: item.depth / 2,
        cosine: Math.cos(yaw),
        sine: Math.sin(yaw),
      };
    });
}

function objectBlocksRay(
  light: SceneItem,
  point: LightPoint,
  object: Occluder,
) {
  if (light.id === object.id) return false;
  const startX = light.x - object.x;
  const startZ = light.z - object.z;
  const endX = point.x - object.x;
  const endZ = point.z - object.z;
  const start = [
    object.cosine * startX - object.sine * startZ,
    light.y + light.height,
    object.sine * startX + object.cosine * startZ,
  ];
  const end = [
    object.cosine * endX - object.sine * endZ,
    0,
    object.sine * endX + object.cosine * endZ,
  ];
  const limits = [
    [-object.halfWidth, object.halfWidth],
    [object.y, object.y + object.height],
    [-object.halfDepth, object.halfDepth],
  ];
  let entry = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < limits[axis][0] || start[axis] > limits[axis][1])
        return false;
      continue;
    }
    const first = (limits[axis][0] - start[axis]) / delta;
    const second = (limits[axis][1] - start[axis]) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }
  // Ignore contact only at the light or sampled floor point.
  return entry < 0.999 && exit > 0.001;
}

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

function singleRayIlluminance(
  light: SceneItem,
  point: LightPoint,
  walls: SceneItem[],
  occluders: Occluder[],
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
  if (occluders.some((object) => objectBlocksRay(light, point, object)))
    return 0;
  return (candela * cosineFloor * falloff) / distanceSquared;
}

function floorIlluminanceWithOccluders(
  light: SceneItem,
  point: LightPoint,
  walls: SceneItem[],
  occluders: Occluder[],
  samples: number,
) {
  if (light.lightType !== "softbox" || samples <= 1)
    return singleRayIlluminance(light, point, walls, occluders);
  const count = Math.max(2, Math.round(Math.sqrt(samples)));
  const size = light.sourceSize ?? 0.6;
  const yaw = (light.rotation * Math.PI) / 180;
  const tilt = ((light.tilt ?? 45) * Math.PI) / 180;
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = {
    x: -Math.sin(yaw) * Math.sin(tilt),
    y: Math.cos(tilt),
    z: -Math.cos(yaw) * Math.sin(tilt),
  };
  let total = 0;
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      const across = ((column + 0.5) / count - 0.5) * size;
      const vertical = ((row + 0.5) / count - 0.5) * size * 0.8;
      total += singleRayIlluminance(
        {
          ...light,
          x: light.x + right.x * across + up.x * vertical,
          y: light.y + up.y * vertical,
          z: light.z + right.z * across + up.z * vertical,
        },
        point,
        walls,
        occluders,
      );
    }
  }
  return total / (count * count);
}

export function floorIlluminance(
  light: SceneItem,
  point: LightPoint,
  walls: SceneItem[],
  objects: SceneItem[] = [],
  samples = 1,
) {
  return floorIlluminanceWithOccluders(
    light,
    point,
    walls,
    prepareOccluders(objects),
    samples,
  );
}

export function sampleFloorIlluminance(
  items: SceneItem[],
  point: LightPoint,
  samples = 1,
) {
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const occluders = prepareOccluders(items);
  const contributors = items
    .filter((item) => item.kind === "light" && !item.hidden)
    .map((light) => ({
      id: light.id,
      name: light.name,
      lux: floorIlluminanceWithOccluders(
        light,
        point,
        walls,
        occluders,
        samples,
      ),
    }))
    .sort((a, b) => b.lux - a.lux);
  return {
    total: contributors.reduce((sum, light) => sum + light.lux, 0),
    contributors,
  };
}

export function traceFloor(items: SceneItem[], step = 0.25, samples = 1) {
  const lights = items.filter((item) => item.kind === "light" && !item.hidden);
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const occluders = prepareOccluders(items);
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
        (total, light) =>
          total +
          floorIlluminanceWithOccluders(
            light,
            point,
            walls,
            occluders,
            samples,
          ),
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
