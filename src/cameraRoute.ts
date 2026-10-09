import { cameraPoseAt, wallEndpoints, wallOpenings } from "./model.ts";
import type { ActorPath, SceneItem, Shot } from "./model.ts";

export interface CameraRouteCollision {
  wallId: string;
  wallName: string;
  progress: number;
  x: number;
  z: number;
}

const cameraRadius = 0.2;
const cameraHalfHeight = 0.12;

function wallContact(
  pose: { x: number; z: number },
  wall: SceneItem,
  radius: number,
  bottom: number,
  top: number,
) {
  const [start, end] = wallEndpoints(wall);
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-8) return false;
  const fraction = Math.min(
    1,
    Math.max(
      0,
      ((pose.x - start.x) * dx + (pose.z - start.z) * dz) / lengthSquared,
    ),
  );
  const closestX = start.x + fraction * dx;
  const closestZ = start.z + fraction * dz;
  const reach = radius + wall.depth / 2;
  if (Math.hypot(pose.x - closestX, pose.z - closestZ) >= reach) return false;
  if (top <= wall.y || bottom >= wall.y + wall.height) return false;
  const wallPosition = (fraction - 0.5) * wall.width;
  return !wallOpenings(wall).some(
    (opening) =>
      Math.abs(wallPosition - opening.offset) + radius <= opening.width / 2 &&
      bottom >= wall.y + opening.sill &&
      top <= wall.y + opening.sill + opening.height,
  );
}

export function cameraRouteCollisions(
  camera: SceneItem,
  shot: Shot,
  items: SceneItem[],
): CameraRouteCollision[] {
  if (!shot.cameraEnd) return [];
  const points = [camera, ...(shot.cameraWaypoints ?? []), shot.cameraEnd];
  const length = points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - points[index].x, point.z - points[index].z),
      0,
    );
  const samples = Math.min(1000, Math.max(64, Math.ceil(length / 0.08)));
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const seen = new Set<string>();
  const collisions: CameraRouteCollision[] = [];
  for (let index = 0; index <= samples; index++) {
    const progress = index / samples;
    const pose = cameraPoseAt(camera, shot, progress);
    for (const wall of walls) {
      if (
        seen.has(wall.id) ||
        !wallContact(
          pose,
          wall,
          cameraRadius,
          pose.height - cameraHalfHeight,
          pose.height + cameraHalfHeight,
        )
      )
        continue;
      seen.add(wall.id);
      collisions.push({
        wallId: wall.id,
        wallName: wall.name,
        progress,
        x: pose.x,
        z: pose.z,
      });
    }
  }
  return collisions;
}

export function actorRouteCollisions(
  actor: SceneItem,
  path: ActorPath,
  items: SceneItem[],
): CameraRouteCollision[] {
  const points = [actor, ...path.waypoints, path.end];
  const walls = items.filter((item) => item.kind === "wall" && !item.hidden);
  const radius = Math.max(0.18, Math.min(actor.width, actor.depth) / 2);
  const totalLength = points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - points[index].x, point.z - points[index].z),
      0,
    );
  if (totalLength < 0.01) return [];
  const seen = new Set<string>();
  const collisions: CameraRouteCollision[] = [];
  let traveled = 0;
  for (let leg = 0; leg < points.length - 1; leg++) {
    const from = points[leg];
    const to = points[leg + 1];
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const samples = Math.min(1000, Math.max(1, Math.ceil(length / 0.08)));
    for (let index = 0; index <= samples; index++) {
      const fraction = index / samples;
      const pose = {
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        z: from.z + (to.z - from.z) * fraction,
      };
      for (const wall of walls) {
        if (
          seen.has(wall.id) ||
          !wallContact(pose, wall, radius, pose.y, pose.y + actor.height)
        )
          continue;
        seen.add(wall.id);
        collisions.push({
          wallId: wall.id,
          wallName: wall.name,
          progress: (traveled + length * fraction) / totalLength,
          x: pose.x,
          z: pose.z,
        });
      }
    }
    traveled += length;
  }
  return collisions;
}
