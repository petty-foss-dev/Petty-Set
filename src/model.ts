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
}

export interface Shot {
  id: string;
  title: string;
  cameraId: string;
  notes: string;
  frame?: string;
  duration: number;
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
    const value = JSON.parse(raw) as Project;
    if (value.version === 1 && Array.isArray(value.scenes)) return value;
  } catch {
    /* Invalid local data starts a fresh project. */
  }
  return sampleProject();
}
