import { aspectRatios, sensors } from "./cinematography.ts";
import type { AspectRatio, SensorId } from "./cinematography.ts";

export type ItemKind =
  | "wall"
  | "actor"
  | "camera"
  | "light"
  | "table"
  | "chair"
  | "box"
  | "sofa"
  | "shelf"
  | "plant"
  | "rug"
  | "tree"
  | "bench"
  | "vehicle"
  | "ground"
  | "asset";

export interface ActorMark {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface ActorPath {
  waypoints: ActorMark[];
  end: ActorMark;
}

export interface SceneEnvironment {
  ground: "studio" | "grass" | "asphalt" | "sand";
  skyColor: string;
  sunAzimuth: number;
  sunElevation: number;
}

export interface SceneItem {
  id: string;
  kind: ItemKind;
  name: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
  intensity?: number;
  spread?: number;
  focalLength?: number;
  cameraBody?: "cinema" | "mirrorless" | "broadcast";
  sensor?: SensorId;
  aperture?: number;
  focusDistance?: number;
  color?: string;
  lightType?: "softbox" | "spot" | "practical";
  assetData?: string;
  roomExtended?: boolean;
  hidden?: boolean;
  locked?: boolean;
  opening?: {
    type: "door" | "window";
    offset: number;
    width: number;
    height: number;
    sill: number;
  };
}

export interface Shot {
  id: string;
  title: string;
  cameraId: string;
  notes: string;
  frame?: string;
  duration: number;
  aspectRatio?: AspectRatio;
  actorMarks?: Record<string, ActorMark>;
  actorPaths?: Record<string, ActorPath>;
  cameraEnd?: { x: number; z: number; height: number; rotation: number };
  cameraWaypoints?: {
    x: number;
    z: number;
    height: number;
    rotation: number;
  }[];
}

export interface SetScene {
  id: string;
  name: string;
  items: SceneItem[];
  shots: Shot[];
  shootOrder: string[];
  floorplan?: string;
  environment?: SceneEnvironment;
  floorplanPlacement?: {
    x: number;
    z: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
  };
}

export interface Project {
  version: 1;
  name: string;
  scenes: SetScene[];
}

export const id = () => crypto.randomUUID();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const itemKinds: ItemKind[] = [
  "wall",
  "actor",
  "camera",
  "light",
  "table",
  "chair",
  "box",
  "sofa",
  "shelf",
  "plant",
  "rug",
  "tree",
  "bench",
  "vehicle",
  "ground",
  "asset",
];

const isActorMark = (value: unknown): value is ActorMark =>
  isRecord(value) &&
  ["x", "y", "z", "rotation"].every((key) => isFiniteNumber(value[key]));

export function isProject(value: unknown): value is Project {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isString(value.name) ||
    !Array.isArray(value.scenes) ||
    value.scenes.length === 0
  )
    return false;
  const sceneIds = new Set<string>();
  for (const scene of value.scenes) {
    if (
      !isRecord(scene) ||
      !isString(scene.id) ||
      sceneIds.has(scene.id) ||
      !isString(scene.name) ||
      !Array.isArray(scene.items) ||
      !Array.isArray(scene.shots) ||
      !Array.isArray(scene.shootOrder) ||
      (scene.floorplan !== undefined && !isString(scene.floorplan))
    )
      return false;
    if (scene.floorplanPlacement !== undefined) {
      const placement = scene.floorplanPlacement;
      if (
        !isRecord(placement) ||
        !["x", "z", "width", "height", "rotation", "opacity"].every((key) =>
          isFiniteNumber(placement[key]),
        ) ||
        (placement.width as number) <= 0 ||
        (placement.height as number) <= 0 ||
        (placement.opacity as number) < 0 ||
        (placement.opacity as number) > 1
      )
        return false;
    }
    if (scene.environment !== undefined) {
      const environment = scene.environment;
      if (
        !isRecord(environment) ||
        !["studio", "grass", "asphalt", "sand"].includes(
          environment.ground as string,
        ) ||
        !isString(environment.skyColor) ||
        !/^#[0-9a-fA-F]{6}$/.test(environment.skyColor) ||
        !isFiniteNumber(environment.sunAzimuth) ||
        !isFiniteNumber(environment.sunElevation) ||
        environment.sunElevation < 0 ||
        environment.sunElevation > 90
      )
        return false;
    }
    sceneIds.add(scene.id);
    const items = new Map<string, ItemKind>();
    for (const item of scene.items) {
      if (
        !isRecord(item) ||
        !isString(item.id) ||
        items.has(item.id) ||
        !itemKinds.includes(item.kind as ItemKind) ||
        !isString(item.name) ||
        !["x", "y", "z", "rotation", "width", "height", "depth"].every((key) =>
          isFiniteNumber(item[key]),
        ) ||
        ["width", "height", "depth"].some(
          (key) => (item[key] as number) <= 0,
        ) ||
        [
          "intensity",
          "spread",
          "focalLength",
          "aperture",
          "focusDistance",
        ].some(
          (key) => item[key] !== undefined && !isFiniteNumber(item[key]),
        ) ||
        ["focalLength", "aperture", "focusDistance"].some(
          (key) => item[key] !== undefined && (item[key] as number) <= 0,
        ) ||
        (item.kind === "camera" &&
          ((item.focusDistance as number | undefined) ?? 3) * 1000 <=
            ((item.focalLength as number | undefined) ?? 35)) ||
        (item.sensor !== undefined &&
          (!isString(item.sensor) || !(item.sensor in sensors))) ||
        ["hidden", "locked"].some(
          (key) => item[key] !== undefined && typeof item[key] !== "boolean",
        ) ||
        (item.color !== undefined && !isString(item.color)) ||
        (item.cameraBody !== undefined &&
          (item.kind !== "camera" ||
            !["cinema", "mirrorless", "broadcast"].includes(
              item.cameraBody as string,
            ))) ||
        (item.lightType !== undefined &&
          !["softbox", "spot", "practical"].includes(
            item.lightType as string,
          )) ||
        (item.kind === "asset" &&
          (!isString(item.assetData) ||
            !item.assetData.startsWith(
              "data:model/gltf-binary;base64,Z2xURgI",
            ) ||
            item.assetData.length > 1_500_000)) ||
        (item.kind !== "asset" && item.assetData !== undefined) ||
        (item.roomExtended !== undefined &&
          (item.kind !== "wall" || typeof item.roomExtended !== "boolean"))
      )
        return false;
      if (item.opening !== undefined) {
        if (
          item.kind !== "wall" ||
          !isRecord(item.opening) ||
          !["door", "window"].includes(item.opening.type as string) ||
          !["offset", "width", "height", "sill"].every((key) =>
            isFiniteNumber((item.opening as Record<string, unknown>)[key]),
          )
        )
          return false;
      }
      items.set(item.id, item.kind as ItemKind);
    }
    const shotIds = new Set<string>();
    for (const shot of scene.shots) {
      if (
        !isRecord(shot) ||
        !isString(shot.id) ||
        shotIds.has(shot.id) ||
        !isString(shot.title) ||
        !isString(shot.notes) ||
        !isString(shot.cameraId) ||
        items.get(shot.cameraId) !== "camera" ||
        !isFiniteNumber(shot.duration) ||
        (shot.aspectRatio !== undefined &&
          (!isString(shot.aspectRatio) ||
            !(shot.aspectRatio in aspectRatios))) ||
        (shot.frame !== undefined && !isString(shot.frame))
      )
        return false;
      if (shot.actorMarks !== undefined) {
        if (!isRecord(shot.actorMarks)) return false;
        for (const [actorId, mark] of Object.entries(shot.actorMarks)) {
          if (items.get(actorId) !== "actor" || !isActorMark(mark))
            return false;
        }
      }
      if (shot.actorPaths !== undefined) {
        if (!isRecord(shot.actorPaths)) return false;
        for (const [actorId, path] of Object.entries(shot.actorPaths)) {
          if (
            items.get(actorId) !== "actor" ||
            !isRecord(path) ||
            !isActorMark(path.end) ||
            !Array.isArray(path.waypoints) ||
            !path.waypoints.every(isActorMark)
          )
            return false;
        }
      }
      if (
        shot.cameraEnd !== undefined &&
        (!isRecord(shot.cameraEnd) ||
          !["x", "z", "height", "rotation"].every((key) =>
            isFiniteNumber((shot.cameraEnd as Record<string, unknown>)[key]),
          ) ||
          (shot.cameraEnd.height as number) <= 0)
      )
        return false;
      if (
        shot.cameraWaypoints !== undefined &&
        (!Array.isArray(shot.cameraWaypoints) ||
          !shot.cameraWaypoints.every(
            (point) =>
              isRecord(point) &&
              ["x", "z", "height", "rotation"].every((key) =>
                isFiniteNumber(point[key]),
              ) &&
              (point.height as number) > 0,
          ))
      )
        return false;
      shotIds.add(shot.id);
    }
    if (
      scene.shootOrder.length !== shotIds.size ||
      new Set(scene.shootOrder).size !== shotIds.size ||
      !scene.shootOrder.every((shotId: unknown) =>
        isString(shotId) ? shotIds.has(shotId) : false,
      )
    )
      return false;
  }
  return true;
}

export function makeItem(kind: ItemKind, count: number): SceneItem {
  const base = {
    id: id(),
    kind,
    name: `${kind[0].toUpperCase()}${kind.slice(1)} ${count}`,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    width: 1,
    height: 1,
    depth: 1,
  };
  switch (kind) {
    case "wall":
      return { ...base, width: 4, height: 2.8, depth: 0.12, x: 0, z: -2 };
    case "actor":
      return { ...base, width: 0.5, height: 1.75, depth: 0.4, z: -1 };
    case "camera":
      return {
        ...base,
        width: 0.4,
        height: 1.6,
        depth: 0.5,
        z: 3,
        focalLength: 35,
        cameraBody: "cinema",
        sensor: "super35",
        aperture: 2.8,
        focusDistance: 3,
      };
    case "light":
      return {
        ...base,
        width: 0.45,
        height: 2.6,
        depth: 0.45,
        x: 2,
        intensity: 2,
        spread: 45,
        color: "#fff4df",
      };
    case "table":
      return { ...base, width: 1.7, height: 0.75, depth: 0.9 };
    case "chair":
      return { ...base, width: 0.55, height: 0.9, depth: 0.55 };
    case "box":
      return { ...base, width: 1, height: 1, depth: 1 };
    case "sofa":
      return { ...base, width: 2, height: 0.85, depth: 0.9 };
    case "shelf":
      return { ...base, width: 1.4, height: 2, depth: 0.4 };
    case "plant":
      return { ...base, width: 0.7, height: 1.6, depth: 0.7 };
    case "rug":
      return { ...base, width: 2.8, height: 0.02, depth: 1.9 };
    case "tree":
      return { ...base, width: 2.6, height: 4.8, depth: 2.6 };
    case "bench":
      return { ...base, width: 1.8, height: 0.95, depth: 0.7 };
    case "vehicle":
      return { ...base, width: 4.2, height: 1.6, depth: 1.8 };
    case "ground":
      return { ...base, width: 2, height: 0.03, depth: 5, color: "#c3bca9" };
    case "asset":
      return { ...base, width: 1, height: 1, depth: 1 };
  }
}

export function actorPoseAt(
  start: ActorMark,
  path: ActorPath,
  progress: number,
) {
  const points = [start, ...path.waypoints, path.end];
  const travel = Math.min(1, Math.max(0, progress)) * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(travel));
  const fraction = travel - segment;
  const from = points[segment];
  const to = points[segment + 1];
  const turn = ((((to.rotation - from.rotation) % 360) + 540) % 360) - 180;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
    rotation: from.rotation + turn * fraction,
  };
}

export function wallBetween(
  start: { x: number; z: number },
  end: { x: number; z: number },
  count: number,
): SceneItem {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return {
    ...makeItem("wall", count),
    x: (start.x + end.x) / 2,
    z: (start.z + end.z) / 2,
    width: Math.hypot(dx, dz),
    rotation: (Math.atan2(-dz, dx) * 180) / Math.PI,
  };
}

export function wallEndpoints(item: SceneItem) {
  const yaw = (item.rotation * Math.PI) / 180;
  const halfX = (item.width / 2) * Math.cos(yaw);
  const halfZ = -(item.width / 2) * Math.sin(yaw);
  return [
    { x: item.x - halfX, z: item.z - halfZ },
    { x: item.x + halfX, z: item.z + halfZ },
  ];
}

export function extendRoom(
  items: SceneItem[],
  wallId: string,
  depth = 4,
): SceneItem[] {
  const wall = items.find((item) => item.id === wallId && item.kind === "wall");
  if (!wall || wall.opening?.type === "window" || wall.roomExtended)
    return items;
  const [start, end] = wallEndpoints(wall);
  const yaw = (wall.rotation * Math.PI) / 180;
  let nx = Math.sin(yaw),
    nz = Math.cos(yaw);
  const others = items.filter(
    (item) => item.kind === "wall" && item.id !== wallId,
  );
  const centerX = others.length
    ? others.reduce((sum, item) => sum + item.x, 0) / others.length
    : wall.x - nx;
  const centerZ = others.length
    ? others.reduce((sum, item) => sum + item.z, 0) / others.length
    : wall.z - nz;
  if ((centerX - wall.x) * nx + (centerZ - wall.z) * nz > 0) {
    nx = -nx;
    nz = -nz;
  }
  const outerStart = { x: start.x + nx * depth, z: start.z + nz * depth };
  const outerEnd = { x: end.x + nx * depth, z: end.z + nz * depth };
  const count = items.filter((item) => item.kind === "wall").length;
  const doorway = wall.opening ?? {
    type: "door" as const,
    offset: 0,
    width: Math.min(1, wall.width - 0.1),
    height: Math.min(2.1, wall.height - 0.1),
    sill: 0,
  };
  return [
    ...items.map((item) =>
      item.id === wall.id
        ? { ...item, opening: doorway, roomExtended: true }
        : item,
    ),
    {
      ...wallBetween(start, outerStart, count + 1),
      height: wall.height,
      name: "Room side",
    },
    {
      ...wallBetween(outerStart, outerEnd, count + 2),
      height: wall.height,
      name: "Room exterior",
    },
    {
      ...wallBetween(outerEnd, end, count + 3),
      height: wall.height,
      name: "Room side",
    },
  ];
}

export function snapWallPoint(
  point: { x: number; z: number },
  items: SceneItem[],
  tolerance = 0.45,
) {
  const endpoints = items
    .filter((item) => item.kind === "wall" && !item.hidden)
    .flatMap(wallEndpoints);
  const nearest = endpoints.reduce<
    { point: { x: number; z: number }; distance: number } | undefined
  >((best, endpoint) => {
    const distance = Math.hypot(endpoint.x - point.x, endpoint.z - point.z);
    return !best || distance < best.distance
      ? { point: endpoint, distance }
      : best;
  }, undefined);
  if (nearest && nearest.distance <= tolerance) return nearest.point;
  return {
    x: Math.round(point.x * 4) / 4,
    z: Math.round(point.z * 4) / 4,
  };
}

export function sampleProject(): Project {
  const scene = furnishedScene();
  return { version: 1, name: "The Conversation", scenes: [scene] };
}

export function furnishedScene(): SetScene {
  const camera = makeItem("camera", 1);
  const actorA = {
    ...makeItem("actor", 1),
    name: "Mara",
    x: -0.65,
    z: -0.8,
    rotation: -25,
  };
  const actorB = {
    ...makeItem("actor", 2),
    name: "Eli",
    x: 0.8,
    z: -0.65,
    rotation: 25,
  };
  const items = [
    {
      ...makeItem("wall", 1),
      name: "Back wall · window",
      z: -3.4,
      width: 8,
      opening: {
        type: "window" as const,
        offset: 0.9,
        width: 2.1,
        height: 1.3,
        sill: 0.85,
      },
    },
    {
      ...makeItem("wall", 2),
      name: "Left wall · doorway",
      x: -4,
      z: -0.4,
      width: 6,
      rotation: 90,
      opening: {
        type: "door" as const,
        offset: 1.15,
        width: 1.05,
        height: 2.15,
        sill: 0,
      },
    },
    {
      ...makeItem("wall", 3),
      name: "Right wall",
      x: 4,
      z: -0.4,
      width: 6,
      rotation: 90,
    },
    {
      ...makeItem("wall", 4),
      name: "Front return",
      x: -2.65,
      z: 2.6,
      width: 2.7,
    },
    {
      ...makeItem("rug", 1),
      name: "Woven rug",
      x: 0,
      z: -0.7,
      width: 3.8,
      depth: 2.6,
    },
    {
      ...makeItem("table", 1),
      name: "Coffee table",
      x: 0,
      z: 0.2,
      width: 1.45,
      height: 0.48,
      depth: 0.75,
    },
    {
      ...makeItem("sofa", 1),
      name: "Linen sofa",
      x: -1.6,
      z: -2.65,
      rotation: 0,
    },
    {
      ...makeItem("chair", 1),
      name: "Accent chair",
      x: 2.15,
      z: -1.6,
      rotation: -50,
    },
    {
      ...makeItem("shelf", 1),
      name: "Bookcase",
      x: -3.4,
      z: -2.5,
      rotation: 90,
    },
    { ...makeItem("plant", 1), name: "Potted tree", x: 3.05, z: -2.55 },
    actorA,
    actorB,
    {
      ...camera,
      x: 0.1,
      z: 5.1,
      height: 1.2,
      rotation: 0,
      focalLength: 35,
      focusDistance: 5.5,
    },
    {
      ...makeItem("light", 1),
      name: "Key · softbox",
      x: -2.7,
      z: 1.1,
      rotation: -28,
      height: 2.75,
    },
    {
      ...makeItem("light", 2),
      name: "Fill · softbox",
      x: 2.8,
      z: 1.35,
      rotation: 30,
      height: 2.35,
      intensity: 1.3,
    },
  ];
  const shot = {
    id: id(),
    title: "Wide master",
    cameraId: camera.id,
    notes: "Establish the room and both actors.",
    duration: 5,
    aspectRatio: "16:9" as AspectRatio,
  };
  return {
    id: id(),
    name: "The Conversation · Interior",
    items,
    shots: [shot],
    shootOrder: [shot.id],
  };
}

export function outdoorScene(): SetScene {
  const camera = {
    ...makeItem("camera", 1),
    x: 0,
    z: 9.5,
    height: 1.45,
    focalLength: 24,
    focusDistance: 9,
  };
  const actor = { ...makeItem("actor", 1), name: "Walker", x: -2, z: 1 };
  const items: SceneItem[] = [
    {
      ...makeItem("ground", 1),
      name: "Walking path",
      x: -1.25,
      z: 1,
      width: 1.8,
      depth: 8.5,
    },
    {
      ...makeItem("ground", 2),
      name: "Parking bay",
      x: 3,
      z: 0.1,
      width: 3.2,
      depth: 5.2,
      color: "#727875",
    },
    { ...makeItem("tree", 1), name: "Oak · left", x: -5.3, z: -3.2 },
    {
      ...makeItem("tree", 2),
      name: "Oak · right",
      x: 5.1,
      z: -4.2,
      height: 5.5,
    },
    {
      ...makeItem("tree", 3),
      name: "Background tree",
      x: -1.6,
      z: -8.5,
      height: 3.9,
    },
    {
      ...makeItem("bench", 1),
      name: "Park bench",
      x: -2.9,
      z: -2.6,
      rotation: -18,
    },
    {
      ...makeItem("vehicle", 1),
      name: "Parked car",
      x: 3,
      z: 0.1,
      rotation: 90,
    },
    actor,
    {
      ...makeItem("actor", 2),
      name: "Listener",
      x: 0.8,
      z: -2.8,
      rotation: -30,
    },
    camera,
  ];
  const shot: Shot = {
    id: id(),
    title: "Approach through the park",
    cameraId: camera.id,
    notes: "Walker crosses from the near path toward the bench.",
    duration: 6,
    aspectRatio: "16:9",
    actorPaths: {
      [actor.id]: {
        waypoints: [{ x: -1.3, y: 0, z: -0.8, rotation: -20 }],
        end: { x: 0, y: 0, z: -2.2, rotation: -35 },
      },
    },
  };
  return {
    id: id(),
    name: "Park entrance · Exterior",
    environment: {
      ground: "grass",
      skyColor: "#a9cce4",
      sunAzimuth: 35,
      sunElevation: 42,
    },
    items,
    shots: [shot],
    shootOrder: [shot.id],
  };
}

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem("petty-set-project");
    if (!raw) return sampleProject();
    const value: unknown = JSON.parse(raw);
    if (isProject(value)) return value;
  } catch {
    /* Invalid local data starts a fresh project. */
  }
  return sampleProject();
}
