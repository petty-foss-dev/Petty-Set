import { cameraPoseAt, wallEndpoints, wallOpenings } from "./model.ts";
import type { SceneItem, Shot } from "./model.ts";

export interface CameraRouteCollision {
  wallId: string;
  wallName: string;
  progress: number;
  x: number;
  z: number;
}

const cameraRadius = 0.2;
const cameraHalfHeight = 0.12;

function wallContact(pose: ReturnType<typeof cameraPoseAt>, wall: SceneItem) {
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
  const reach = cameraRadius + wall.depth / 2;
  if (Math.hypot(pose.x - closestX, pose.z - closestZ) >= reach) return false;
  if (
    pose.height + cameraHalfHeight <= wall.y ||
    pose.height - cameraHalfHeight >= wall.y + wall.height
  )
    return false;
  const wallPosition = (fraction - 0.5) * wall.width;
  return !wallOpenings(wall).some(
    (opening) =>
      Math.abs(wallPosition - opening.offset) + cameraRadius <=
        opening.width / 2 &&
      pose.height - cameraHalfHeight >= wall.y + opening.sill &&
      pose.height + cameraHalfHeight <= wall.y + opening.sill + opening.height,
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
      if (seen.has(wall.id) || !wallContact(pose, wall)) continue;
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
