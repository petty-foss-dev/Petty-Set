export type ItemKind =
  "wall" | "actor" | "camera" | "light" | "table" | "chair" | "box";

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
  color?: string;
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
  actorMarks?: Record<
    string,
    { x: number; y: number; z: number; rotation: number }
  >;
}

export interface SetScene {
  id: string;
  name: string;
  items: SceneItem[];
  shots: Shot[];
  shootOrder: string[];
  floorplan?: string;
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
];

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
        ["intensity", "spread", "focalLength"].some(
          (key) => item[key] !== undefined && !isFiniteNumber(item[key]),
        ) ||
        ["hidden", "locked"].some(
          (key) => item[key] !== undefined && typeof item[key] !== "boolean",
        ) ||
        (item.color !== undefined && !isString(item.color))
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
        (shot.frame !== undefined && !isString(shot.frame))
      )
        return false;
      if (shot.actorMarks !== undefined) {
        if (!isRecord(shot.actorMarks)) return false;
        for (const [actorId, mark] of Object.entries(shot.actorMarks)) {
          if (
            items.get(actorId) !== "actor" ||
            !isRecord(mark) ||
            !["x", "y", "z", "rotation"].every((key) =>
              isFiniteNumber(mark[key]),
            )
          )
            return false;
        }
      }
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
  }
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

export function sampleProject(): Project {
  const camera = makeItem("camera", 1);
  const actorA = { ...makeItem("actor", 1), x: -0.8 };
  const actorB = { ...makeItem("actor", 2), x: 0.8 };
  const items = [
    { ...makeItem("wall", 1), z: -3, width: 7 },
    { ...makeItem("wall", 2), x: -3.5, z: 0, width: 6, rotation: 90 },
    { ...makeItem("wall", 3), x: 3.5, z: 0, width: 6, rotation: 90 },
    { ...makeItem("table", 1), z: -0.2 },
    actorA,
    actorB,
    camera,
    { ...makeItem("light", 1), x: -2, z: 1 },
  ];
  const shot = {
    id: id(),
    title: "Wide master",
    cameraId: camera.id,
    notes: "Establish the room and both actors.",
    duration: 5,
  };
  return {
    version: 1,
    name: "Untitled film",
    scenes: [
      {
        id: id(),
        name: "Scene 1 · Interior",
        items,
        shots: [shot],
        shootOrder: [shot.id],
      },
    ],
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
