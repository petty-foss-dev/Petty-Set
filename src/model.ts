import {
  aspectRatios,
  cameraPresets,
  lensPresets,
  sensors,
} from "./cinematography.ts";
import type {
  AspectRatio,
  CameraPresetId,
  LensPresetId,
  SensorId,
} from "./cinematography.ts";
import { actorActions } from "./actorActions.ts";
import type { ActorAction } from "./actorActions.ts";

export type ItemKind =
  | "wall"
  | "actor"
  | "camera"
  | "light"
  | "power"
  | "table"
  | "chair"
  | "box"
  | "sofa"
  | "shelf"
  | "bed"
  | "cabinet"
  | "deskLamp"
  | "monitor"
  | "plant"
  | "rug"
  | "tree"
  | "bench"
  | "vehicle"
  | "ground"
  | "facade"
  | "streetlamp"
  | "barrel"
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
  legs?: ActorPathLeg[];
}

export interface ActorPathLeg {
  weight: number;
  easing: "linear" | "smooth";
}

export interface MannequinJoints {
  headTilt: number;
  headNod: number;
  leftShoulderSwing: number;
  rightShoulderSwing: number;
  leftArmLift: number;
  rightArmLift: number;
  leftElbowBend: number;
  rightElbowBend: number;
  leftHipSwing: number;
  rightHipSwing: number;
  leftKneeBend: number;
  rightKneeBend: number;
}

export interface SavedPose {
  id: string;
  name: string;
  joints: MannequinJoints;
}

export interface PoseKeyframe {
  at: number;
  joints: MannequinJoints;
}

export interface LightKeyframe {
  at: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  tilt: number;
}

export const mannequinJointControls: {
  key: keyof MannequinJoints;
  label: string;
  min: number;
  max: number;
  group: "Head" | "Arms" | "Legs";
}[] = [
  { key: "headTilt", label: "Tilt", min: -45, max: 45, group: "Head" },
  { key: "headNod", label: "Nod", min: -35, max: 35, group: "Head" },
  {
    key: "leftShoulderSwing",
    label: "Left arm forward",
    min: -110,
    max: 110,
    group: "Arms",
  },
  {
    key: "rightShoulderSwing",
    label: "Right arm forward",
    min: -110,
    max: 110,
    group: "Arms",
  },
  {
    key: "leftArmLift",
    label: "Left arm raise",
    min: 0,
    max: 160,
    group: "Arms",
  },
  {
    key: "rightArmLift",
    label: "Right arm raise",
    min: 0,
    max: 160,
    group: "Arms",
  },
  {
    key: "leftElbowBend",
    label: "Left elbow",
    min: 0,
    max: 145,
    group: "Arms",
  },
  {
    key: "rightElbowBend",
    label: "Right elbow",
    min: 0,
    max: 145,
    group: "Arms",
  },
  {
    key: "leftHipSwing",
    label: "Left leg forward",
    min: -75,
    max: 75,
    group: "Legs",
  },
  {
    key: "rightHipSwing",
    label: "Right leg forward",
    min: -75,
    max: 75,
    group: "Legs",
  },
  { key: "leftKneeBend", label: "Left knee", min: 0, max: 130, group: "Legs" },
  {
    key: "rightKneeBend",
    label: "Right knee",
    min: 0,
    max: 130,
    group: "Legs",
  },
];

export function mannequinJointsForPose(
  pose: SceneItem["mannequinPose"],
): MannequinJoints {
  return {
    headTilt: 0,
    headNod: 0,
    leftShoulderSwing: 0,
    rightShoulderSwing: 0,
    leftArmLift: 0,
    rightArmLift: pose === "greeting" ? 154 : pose === "pointing" ? 81 : 0,
    leftElbowBend: 0,
    rightElbowBend: pose === "greeting" ? 13 : 0,
    leftHipSwing: 0,
    rightHipSwing: 0,
    leftKneeBend: 0,
    rightKneeBend: 0,
  };
}

export function mannequinPoseForJoints(
  joints: MannequinJoints,
): SceneItem["mannequinPose"] | "custom" {
  for (const pose of ["neutral", "greeting", "pointing"] as const) {
    const preset = mannequinJointsForPose(pose);
    if (mannequinJointControls.every(({ key }) => joints[key] === preset[key]))
      return pose;
  }
  return "custom";
}

export interface SceneEnvironment {
  ground: "studio" | "grass" | "asphalt" | "sand";
  skyColor: string;
  sunAzimuth: number;
  sunElevation: number;
}

export interface WallOpening {
  type: "door" | "window";
  offset: number;
  width: number;
  height: number;
  sill: number;
}

export interface SceneItem {
  id: string;
  layerId?: string;
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
  lumens?: number;
  tilt?: number;
  spread?: number;
  focalLength?: number;
  cameraBody?: "cinema" | "mirrorless" | "broadcast";
  cameraPreset?: CameraPresetId;
  sensor?: SensorId;
  lensPreset?: LensPresetId;
  aperture?: number;
  focusDistance?: number;
  color?: string;
  lightType?: "softbox" | "spot" | "practical";
  powerWatts?: number;
  capacityWatts?: number;
  powerSourceId?: string;
  facadeStyle?: "storefront" | "brick" | "theater";
  signText?: string;
  surfaceStyle?: "plain" | "road" | "sidewalk";
  mannequinPose?: "neutral" | "greeting" | "pointing";
  mannequinJoints?: MannequinJoints;
  assetData?: string;
  assetRef?: string;
  roomExtended?: boolean;
  wallFinish?: "plaster" | "brick" | "timber" | "concrete";
  hidden?: boolean;
  locked?: boolean;
  opening?: WallOpening;
  additionalOpenings?: WallOpening[];
}

export interface SceneLayer {
  id: string;
  name: string;
  hidden?: boolean;
  locked?: boolean;
}

export const baseLayerId = "base";

export function sceneLayers(scene: SetScene): SceneLayer[] {
  return scene.layers ?? [{ id: baseLayerId, name: "Base" }];
}

export function resolveSceneLayers(scene: SetScene): SetScene {
  const layers = new Map(sceneLayers(scene).map((layer) => [layer.id, layer]));
  return {
    ...scene,
    items: scene.items.map((item) => {
      const layer = layers.get(item.layerId ?? baseLayerId);
      return {
        ...item,
        hidden: !!item.hidden || !!layer?.hidden,
        locked: !!item.locked || !!layer?.locked,
      };
    }),
  };
}

export function wallOpenings(wall: SceneItem): WallOpening[] {
  return [
    ...(wall.opening ? [wall.opening] : []),
    ...(wall.additionalOpenings ?? []),
  ];
}

export function openingFits(
  wall: SceneItem,
  candidate: WallOpening,
  replacing = -1,
): boolean {
  if (
    wall.kind !== "wall" ||
    !["door", "window"].includes(candidate.type) ||
    ![
      candidate.offset,
      candidate.width,
      candidate.height,
      candidate.sill,
    ].every(Number.isFinite) ||
    candidate.width < 0.1 ||
    candidate.height < 0.1
  )
    return false;
  if (Math.abs(candidate.offset) + candidate.width / 2 > wall.width / 2 - 0.05)
    return false;
  if (
    candidate.sill < 0 ||
    candidate.sill + candidate.height > wall.height - 0.05
  )
    return false;
  return wallOpenings(wall).every(
    (opening, index) =>
      index === replacing ||
      Math.abs(opening.offset - candidate.offset) >=
        (opening.width + candidate.width) / 2 + 0.1,
  );
}

export function addWallOpening(
  wall: SceneItem,
  type: WallOpening["type"],
): SceneItem {
  const width = Math.min(0.9, wall.width - 0.1);
  const sill = type === "window" ? 1 : 0;
  const height = Math.min(
    type === "window" ? 1 : 2.1,
    wall.height - sill - 0.05,
  );
  const limit = Math.floor((wall.width / 2 - width / 2 - 0.05) * 10);
  for (let step = 0; step <= limit; step++) {
    for (const offset of step === 0 ? [0] : [-step / 10, step / 10]) {
      const opening = { type, offset, width, height, sill };
      if (!openingFits(wall, opening)) continue;
      if (!wall.opening) return { ...wall, opening };
      return {
        ...wall,
        additionalOpenings: [...(wall.additionalOpenings ?? []), opening],
      };
    }
  }
  return wall;
}

export function replaceWallOpening(
  wall: SceneItem,
  index: number,
  opening?: WallOpening,
): SceneItem {
  const openings = wallOpenings(wall);
  if (index < 0 || index >= openings.length) return wall;
  if (opening && !openingFits(wall, opening, index)) return wall;
  openings.splice(index, 1, ...(opening ? [opening] : []));
  return {
    ...wall,
    opening: openings[0],
    additionalOpenings: openings.length > 1 ? openings.slice(1) : undefined,
  };
}

export interface Shot {
  id: string;
  title: string;
  cameraId: string;
  notes: string;
  setup?: string;
  status?: "planned" | "ready" | "shot";
  lightingPlans?: ShotLightingPlan[];
  activeLightingPlanId?: string;
  frame?: string;
  reference?: { name: string; image: string };
  duration: number;
  aspectRatio?: AspectRatio;
  actorMarks?: Record<string, ActorMark>;
  actorPaths?: Record<string, ActorPath>;
  actorJoints?: Record<string, MannequinJoints>;
  actorPoseKeys?: Record<string, PoseKeyframe[]>;
  actorActions?: Record<string, ActorAction>;
  lightKeys?: Record<string, LightKeyframe[]>;
  lightTargetActors?: Record<string, string>;
  cameraTargetActorId?: string;
  cameraEnd?: { x: number; z: number; height: number; rotation: number };
  cameraMoveStyle?: "linear" | "smooth";
  cameraWaypoints?: {
    x: number;
    z: number;
    height: number;
    rotation: number;
  }[];
}

export interface ShotLightingPlan {
  id: string;
  name: string;
  fixtures: Record<
    string,
    Omit<Partial<SceneItem>, "powerSourceId"> & {
      powerSourceId?: string | null;
    }
  >;
}

export interface SetScene {
  id: string;
  name: string;
  layers?: SceneLayer[];
  items: SceneItem[];
  shots: Shot[];
  shootOrder: string[];
  floorplan?: string;
  roomFinishes?: RoomFinish[];
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

export type FloorFinish = "timber" | "tile" | "concrete" | "stone";

export interface RoomFinish {
  finish: FloorFinish;
  points: { x: number; z: number }[];
}

export interface Project {
  version: 1;
  name: string;
  scenes: SetScene[];
  savedPoses?: SavedPose[];
}

export const id = () => crypto.randomUUID();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isWallOpening = (value: unknown): value is WallOpening =>
  isRecord(value) &&
  ["door", "window"].includes(value.type as string) &&
  ["offset", "width", "height", "sill"].every((key) =>
    isFiniteNumber(value[key]),
  );
const itemKinds: ItemKind[] = [
  "wall",
  "actor",
  "camera",
  "light",
  "power",
  "table",
  "chair",
  "box",
  "sofa",
  "shelf",
  "bed",
  "cabinet",
  "deskLamp",
  "monitor",
  "plant",
  "rug",
  "tree",
  "bench",
  "vehicle",
  "ground",
  "facade",
  "streetlamp",
  "barrel",
  "asset",
];

const isActorMark = (value: unknown): value is ActorMark =>
  isRecord(value) &&
  ["x", "y", "z", "rotation"].every((key) => isFiniteNumber(value[key]));
const isMannequinJoints = (value: unknown): value is MannequinJoints =>
  isRecord(value) &&
  mannequinJointControls.every(
    ({ key, min, max }) =>
      isFiniteNumber(value[key]) &&
      (value[key] as number) >= min &&
      (value[key] as number) <= max,
  );

export function isProject(value: unknown): value is Project {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isString(value.name) ||
    !Array.isArray(value.scenes) ||
    value.scenes.length === 0
  )
    return false;
  if (value.savedPoses !== undefined) {
    if (!Array.isArray(value.savedPoses)) return false;
    const poseIds = new Set<string>();
    const poseNames = new Set<string>();
    for (const pose of value.savedPoses) {
      if (
        !isRecord(pose) ||
        !isString(pose.id) ||
        !pose.id ||
        poseIds.has(pose.id) ||
        !isString(pose.name) ||
        pose.name.trim() !== pose.name ||
        !pose.name ||
        pose.name.length > 60 ||
        poseNames.has(pose.name.toLocaleLowerCase()) ||
        !isMannequinJoints(pose.joints)
      )
        return false;
      poseIds.add(pose.id);
      poseNames.add(pose.name.toLocaleLowerCase());
    }
  }
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
    if (
      scene.roomFinishes !== undefined &&
      (!Array.isArray(scene.roomFinishes) ||
        scene.roomFinishes.some(
          (assignment) =>
            !isRecord(assignment) ||
            !["timber", "tile", "concrete", "stone"].includes(
              assignment.finish as string,
            ) ||
            !Array.isArray(assignment.points) ||
            assignment.points.length < 3 ||
            assignment.points.some(
              (point) =>
                !isRecord(point) ||
                !isFiniteNumber(point.x) ||
                !isFiniteNumber(point.z),
            ),
        ))
    )
      return false;
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
    if (scene.layers !== undefined) {
      if (
        !Array.isArray(scene.layers) ||
        !scene.layers.some(
          (layer) => isRecord(layer) && layer.id === baseLayerId,
        )
      )
        return false;
      const layerIds = new Set<string>();
      const layerNames = new Set<string>();
      for (const layer of scene.layers) {
        if (
          !isRecord(layer) ||
          !isString(layer.id) ||
          !layer.id ||
          layerIds.has(layer.id) ||
          !isString(layer.name) ||
          !layer.name.trim() ||
          layer.name.length > 60 ||
          layerNames.has(layer.name.trim().toLowerCase()) ||
          (layer.hidden !== undefined && typeof layer.hidden !== "boolean") ||
          (layer.locked !== undefined && typeof layer.locked !== "boolean")
        )
          return false;
        layerIds.add(layer.id);
        layerNames.add(layer.name.trim().toLowerCase());
      }
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
        (item.layerId !== undefined &&
          (!isString(item.layerId) ||
            !sceneLayers(scene as unknown as SetScene).some(
              (layer) => layer.id === item.layerId,
            ))) ||
        !["x", "y", "z", "rotation", "width", "height", "depth"].every((key) =>
          isFiniteNumber(item[key]),
        ) ||
        ["width", "height", "depth"].some(
          (key) => (item[key] as number) <= 0,
        ) ||
        [
          "intensity",
          "spread",
          "lumens",
          "tilt",
          "focalLength",
          "aperture",
          "focusDistance",
        ].some(
          (key) => item[key] !== undefined && !isFiniteNumber(item[key]),
        ) ||
        (item.lumens !== undefined &&
          (item.kind !== "light" ||
            (item.lumens as number) < 0 ||
            (item.lumens as number) > 100_000)) ||
        (item.tilt !== undefined &&
          (item.kind !== "light" ||
            (item.tilt as number) < 5 ||
            (item.tilt as number) > 90)) ||
        ["focalLength", "aperture", "focusDistance"].some(
          (key) => item[key] !== undefined && (item[key] as number) <= 0,
        ) ||
        (item.kind === "camera" &&
          ((item.focusDistance as number | undefined) ?? 3) * 1000 <=
            ((item.focalLength as number | undefined) ?? 35)) ||
        (item.sensor !== undefined &&
          (!isString(item.sensor) || !(item.sensor in sensors))) ||
        (item.cameraPreset !== undefined &&
          (item.kind !== "camera" ||
            !isString(item.cameraPreset) ||
            !(item.cameraPreset in cameraPresets))) ||
        (item.lensPreset !== undefined &&
          (item.kind !== "camera" ||
            !isString(item.lensPreset) ||
            !(item.lensPreset in lensPresets))) ||
        (item.cameraPreset !== undefined &&
          !(
            cameraPresets[item.cameraPreset as CameraPresetId]
              .sensorModes as readonly string[]
          ).includes(item.sensor as string)) ||
        (item.lensPreset !== undefined &&
          (((item.focalLength as number | undefined) ?? 35) !==
            lensPresets[item.lensPreset as LensPresetId].focalLength ||
            ((item.focusDistance as number | undefined) ?? 3) <
              lensPresets[item.lensPreset as LensPresetId].minFocus)) ||
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
        (item.powerWatts !== undefined &&
          (item.kind !== "light" ||
            !isFiniteNumber(item.powerWatts) ||
            item.powerWatts <= 0)) ||
        (item.capacityWatts !== undefined &&
          (item.kind !== "power" ||
            !isFiniteNumber(item.capacityWatts) ||
            item.capacityWatts <= 0)) ||
        (item.powerSourceId !== undefined &&
          (item.kind !== "light" || !isString(item.powerSourceId))) ||
        (item.facadeStyle !== undefined &&
          (item.kind !== "facade" ||
            !["storefront", "brick", "theater"].includes(
              item.facadeStyle as string,
            ))) ||
        (item.signText !== undefined &&
          (item.kind !== "facade" ||
            !isString(item.signText) ||
            item.signText.length > 24)) ||
        (item.surfaceStyle !== undefined &&
          (item.kind !== "ground" ||
            !["plain", "road", "sidewalk"].includes(
              item.surfaceStyle as string,
            ))) ||
        (item.mannequinPose !== undefined &&
          (item.kind !== "actor" ||
            !["neutral", "greeting", "pointing"].includes(
              item.mannequinPose as string,
            ))) ||
        (item.mannequinJoints !== undefined &&
          (item.kind !== "actor" ||
            !isMannequinJoints(item.mannequinJoints))) ||
        (item.kind === "asset" &&
          (!(
            (isString(item.assetRef) &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                item.assetRef,
              )) ||
            (isString(item.assetData) &&
              item.assetData.startsWith(
                "data:model/gltf-binary;base64,Z2xURgI",
              ) &&
              item.assetData.length <= 66_666_704)
          ) ||
            (item.assetData !== undefined && item.assetRef !== undefined))) ||
        (item.kind !== "asset" &&
          (item.assetData !== undefined || item.assetRef !== undefined)) ||
        (item.roomExtended !== undefined &&
          (item.kind !== "wall" || typeof item.roomExtended !== "boolean")) ||
        (item.wallFinish !== undefined &&
          (item.kind !== "wall" ||
            !["plaster", "brick", "timber", "concrete"].includes(
              item.wallFinish as string,
            )))
      )
        return false;
      if (
        item.opening !== undefined &&
        (item.kind !== "wall" || !isWallOpening(item.opening))
      )
        return false;
      if (
        item.additionalOpenings !== undefined &&
        (item.kind !== "wall" ||
          !Array.isArray(item.additionalOpenings) ||
          !item.additionalOpenings.every(isWallOpening))
      )
        return false;
      if (
        item.additionalOpenings !== undefined &&
        wallOpenings(item as unknown as SceneItem).some(
          (opening, index) =>
            !openingFits(item as unknown as SceneItem, opening, index),
        )
      )
        return false;
      items.set(item.id, item.kind as ItemKind);
    }
    if (
      scene.items.some(
        (item) =>
          item.powerSourceId !== undefined &&
          items.get(item.powerSourceId) !== "power",
      )
    )
      return false;
    const shotIds = new Set<string>();
    for (const shot of scene.shots) {
      if (
        !isRecord(shot) ||
        !isString(shot.id) ||
        shotIds.has(shot.id) ||
        !isString(shot.title) ||
        !isString(shot.notes) ||
        (shot.setup !== undefined && !isString(shot.setup)) ||
        (shot.status !== undefined &&
          !["planned", "ready", "shot"].includes(shot.status as string)) ||
        !isString(shot.cameraId) ||
        items.get(shot.cameraId) !== "camera" ||
        !isFiniteNumber(shot.duration) ||
        (shot.aspectRatio !== undefined &&
          (!isString(shot.aspectRatio) ||
            !(shot.aspectRatio in aspectRatios))) ||
        (shot.frame !== undefined && !isString(shot.frame)) ||
        (shot.reference !== undefined &&
          (!isRecord(shot.reference) ||
            !isString(shot.reference.name) ||
            !isString(shot.reference.image) ||
            !shot.reference.image.startsWith("data:image/jpeg;base64,")))
      )
        return false;
      if (shot.lightingPlans !== undefined) {
        if (!Array.isArray(shot.lightingPlans) || !shot.lightingPlans.length)
          return false;
        const planIds = new Set<string>();
        for (const plan of shot.lightingPlans) {
          if (
            !isRecord(plan) ||
            !isString(plan.id) ||
            planIds.has(plan.id) ||
            !isString(plan.name) ||
            !isRecord(plan.fixtures)
          )
            return false;
          planIds.add(plan.id);
          for (const [fixtureId, fixture] of Object.entries(plan.fixtures)) {
            if (
              items.get(fixtureId) !== "light" ||
              !isRecord(fixture) ||
              Object.keys(fixture).some(
                (key) =>
                  ![
                    "x",
                    "y",
                    "z",
                    "rotation",
                    "height",
                    "intensity",
                    "lumens",
                    "tilt",
                    "spread",
                    "color",
                    "lightType",
                    "powerWatts",
                    "powerSourceId",
                    "hidden",
                  ].includes(key),
              ) ||
              [
                "x",
                "y",
                "z",
                "rotation",
                "height",
                "intensity",
                "lumens",
                "tilt",
                "spread",
                "powerWatts",
              ].some(
                (key) =>
                  fixture[key] !== undefined && !isFiniteNumber(fixture[key]),
              ) ||
              (fixture.height !== undefined &&
                (fixture.height as number) <= 0) ||
              (fixture.lumens !== undefined &&
                ((fixture.lumens as number) < 0 ||
                  (fixture.lumens as number) > 100_000)) ||
              (fixture.tilt !== undefined &&
                ((fixture.tilt as number) < 5 ||
                  (fixture.tilt as number) > 90)) ||
              (fixture.powerWatts !== undefined &&
                (fixture.powerWatts as number) <= 0) ||
              (fixture.lightType !== undefined &&
                !["softbox", "spot", "practical"].includes(
                  fixture.lightType as string,
                )) ||
              (fixture.color !== undefined && !isString(fixture.color)) ||
              (fixture.hidden !== undefined &&
                typeof fixture.hidden !== "boolean") ||
              (fixture.powerSourceId !== undefined &&
                fixture.powerSourceId !== null &&
                items.get(fixture.powerSourceId as string) !== "power")
            )
              return false;
          }
        }
        if (
          !isString(shot.activeLightingPlanId) ||
          !planIds.has(shot.activeLightingPlanId)
        )
          return false;
      } else if (shot.activeLightingPlanId !== undefined) return false;
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
            !path.waypoints.every(isActorMark) ||
            (path.legs !== undefined &&
              (!Array.isArray(path.legs) ||
                path.legs.length !== path.waypoints.length + 1 ||
                !path.legs.every(
                  (leg) =>
                    isRecord(leg) &&
                    typeof leg.weight === "number" &&
                    Number.isFinite(leg.weight) &&
                    leg.weight > 0 &&
                    (leg.easing === "linear" || leg.easing === "smooth"),
                ) ||
                !Number.isFinite(
                  path.legs.reduce((sum, leg) => sum + leg.weight, 0),
                )))
          )
            return false;
        }
      }
      if (shot.actorJoints !== undefined) {
        if (!isRecord(shot.actorJoints)) return false;
        for (const [actorId, joints] of Object.entries(shot.actorJoints)) {
          if (items.get(actorId) !== "actor" || !isMannequinJoints(joints))
            return false;
        }
      }
      if (shot.actorPoseKeys !== undefined) {
        if (!isRecord(shot.actorPoseKeys)) return false;
        for (const [actorId, keys] of Object.entries(shot.actorPoseKeys)) {
          if (
            items.get(actorId) !== "actor" ||
            !Array.isArray(keys) ||
            !keys.length ||
            !keys.every(
              (key, index) =>
                isRecord(key) &&
                isFiniteNumber(key.at) &&
                key.at >= 0 &&
                key.at <= 1 &&
                (index === 0 || key.at > keys[index - 1].at) &&
                isMannequinJoints(key.joints),
            )
          )
            return false;
        }
      }
      if (shot.lightKeys !== undefined) {
        if (!isRecord(shot.lightKeys)) return false;
        for (const [lightId, keys] of Object.entries(shot.lightKeys)) {
          if (
            items.get(lightId) !== "light" ||
            !Array.isArray(keys) ||
            !keys.length ||
            !keys.every(
              (key, index) =>
                isRecord(key) &&
                isFiniteNumber(key.at) &&
                key.at >= 0 &&
                key.at <= 1 &&
                (index === 0 || key.at > keys[index - 1].at) &&
                ["x", "y", "z", "rotation", "tilt"].every((field) =>
                  isFiniteNumber(key[field]),
                ) &&
                (key.tilt as number) >= 5 &&
                (key.tilt as number) <= 90,
            )
          )
            return false;
        }
      }
      if (
        shot.lightTargetActors !== undefined &&
        (!isRecord(shot.lightTargetActors) ||
          Object.entries(shot.lightTargetActors).some(
            ([lightId, actorId]) =>
              items.get(lightId) !== "light" ||
              items.get(actorId as string) !== "actor",
          ))
      )
        return false;
      if (
        shot.cameraTargetActorId !== undefined &&
        items.get(shot.cameraTargetActorId as string) !== "actor"
      )
        return false;
      if (shot.actorActions !== undefined) {
        if (!isRecord(shot.actorActions)) return false;
        for (const [actorId, action] of Object.entries(shot.actorActions)) {
          if (
            items.get(actorId) !== "actor" ||
            !isRecord(action) ||
            !actorActions.some((entry) => entry.id === action.id) ||
            typeof action.loop !== "boolean" ||
            !isFiniteNumber(action.speed) ||
            action.speed < 0.25 ||
            action.speed > 3
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
      if (
        shot.cameraMoveStyle !== undefined &&
        !["linear", "smooth"].includes(shot.cameraMoveStyle as string)
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
      return {
        ...base,
        width: 0.5,
        height: 1.75,
        depth: 0.4,
        z: -1,
        mannequinPose: "neutral",
      };
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
        tilt: 45,
        spread: 45,
        color: "#fff4df",
        powerWatts: 150,
      };
    case "power":
      return {
        ...base,
        width: 0.48,
        height: 0.55,
        depth: 0.32,
        x: -2,
        z: 2,
        capacityWatts: 2000,
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
    case "bed":
      return { ...base, width: 2, height: 0.85, depth: 2.2 };
    case "cabinet":
      return { ...base, width: 1.2, height: 1.7, depth: 0.55 };
    case "deskLamp":
      return {
        ...base,
        name: `Desk lamp ${count}`,
        width: 0.45,
        height: 0.65,
        depth: 0.45,
      };
    case "monitor":
      return { ...base, width: 0.8, height: 0.6, depth: 0.25 };
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
      return {
        ...base,
        width: 2,
        height: 0.03,
        depth: 5,
        color: "#c3bca9",
        surfaceStyle: "plain",
      };
    case "facade":
      return {
        ...base,
        width: 3.4,
        height: 3.2,
        depth: 0.5,
        facadeStyle: "storefront",
        signText: "MARKET",
      };
    case "streetlamp":
      return { ...base, width: 0.8, height: 3.5, depth: 0.8 };
    case "barrel":
      return { ...base, width: 0.7, height: 1, depth: 0.7 };
    case "asset":
      return { ...base, width: 1, height: 1, depth: 1 };
  }
}

export function keyedPoseAt(
  keys: PoseKeyframe[],
  progress: number,
): MannequinJoints {
  const { from, to, fraction } = keySegment(keys, progress);
  return Object.fromEntries(
    mannequinJointControls.map(({ key }) => [
      key,
      from.joints[key] + (to.joints[key] - from.joints[key]) * fraction,
    ]),
  ) as unknown as MannequinJoints;
}

export function keyedLightAt(
  keys: LightKeyframe[],
  progress: number,
): Omit<LightKeyframe, "at"> {
  const { from, to, fraction } = keySegment(keys, progress);
  const angle = ((((to.rotation - from.rotation) % 360) + 540) % 360) - 180;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
    rotation: from.rotation + angle * fraction,
    tilt: from.tilt + (to.tilt - from.tilt) * fraction,
  };
}

export function aimYaw(
  from: Pick<SceneItem, "x" | "z">,
  target: Pick<SceneItem, "x" | "z">,
) {
  return (Math.atan2(from.x - target.x, from.z - target.z) * 180) / Math.PI;
}

export function aimLightAtActor(light: SceneItem, actor: SceneItem) {
  const horizontal = Math.hypot(actor.x - light.x, actor.z - light.z);
  const vertical = light.y + light.height - (actor.y + actor.height * 0.7);
  return {
    rotation: aimYaw(light, actor),
    tilt: Math.min(
      90,
      Math.max(5, (Math.atan2(vertical, horizontal) * 180) / Math.PI),
    ),
  };
}

function keySegment<T extends { at: number }>(keys: T[], progress: number) {
  const toIndex = keys.findIndex((key) => key.at >= progress);
  if (toIndex === -1)
    return { from: keys.at(-1)!, to: keys.at(-1)!, fraction: 0 };
  if (toIndex <= 0) return { from: keys[0], to: keys[0], fraction: 0 };
  const from = keys[toIndex - 1];
  const to = keys[toIndex];
  return { from, to, fraction: (progress - from.at) / (to.at - from.at) };
}

export function actorPoseAt(
  start: ActorMark,
  path: ActorPath,
  progress: number,
) {
  const points = [start, ...path.waypoints, path.end];
  const legs = actorPathLegs(path);
  const total = legs.reduce((sum, leg) => sum + leg.weight, 0);
  const travel = Math.min(1, Math.max(0, progress)) * total;
  let segment = 0;
  let elapsed = 0;
  while (
    segment < legs.length - 1 &&
    travel >= elapsed + legs[segment].weight
  ) {
    elapsed += legs[segment].weight;
    segment++;
  }
  const linear = (travel - elapsed) / legs[segment].weight;
  const fraction =
    legs[segment].easing === "smooth"
      ? linear * linear * (3 - 2 * linear)
      : linear;
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

export function actorPathLegs(path: ActorPath): ActorPathLeg[] {
  return (
    path.legs ??
    Array.from({ length: path.waypoints.length + 1 }, () => ({
      weight: 1,
      easing: "linear" as const,
    }))
  );
}

export function cameraPoseAt(
  start: Pick<SceneItem, "x" | "z" | "height" | "rotation">,
  shot: Pick<Shot, "cameraEnd" | "cameraWaypoints" | "cameraMoveStyle">,
  progress: number,
) {
  const points = [
    start,
    ...(shot.cameraWaypoints ?? []),
    shot.cameraEnd ?? start,
  ];
  const travel = Math.min(1, Math.max(0, progress)) * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(travel));
  const fraction = travel - segment;
  const from = points[segment];
  const to = points[segment + 1];
  const nearestAngle = (base: number, angle: number) =>
    base + ((((angle - base) % 360) + 540) % 360) - 180;
  const endAngle = nearestAngle(from.rotation, to.rotation);
  if (shot.cameraMoveStyle !== "smooth")
    return {
      x: from.x + (to.x - from.x) * fraction,
      z: from.z + (to.z - from.z) * fraction,
      height: from.height + (to.height - from.height) * fraction,
      rotation: from.rotation + (endAngle - from.rotation) * fraction,
    };

  const before = points[Math.max(0, segment - 1)];
  const after = points[Math.min(points.length - 1, segment + 2)];
  const curve = (a: number, b: number, c: number, d: number) => {
    const t2 = fraction * fraction;
    const t3 = t2 * fraction;
    return (
      0.5 *
      (2 * b +
        (-a + c) * fraction +
        (2 * a - 5 * b + 4 * c - d) * t2 +
        (-a + 3 * b - 3 * c + d) * t3)
    );
  };
  return {
    x: curve(before.x, from.x, to.x, after.x),
    z: curve(before.z, from.z, to.z, after.z),
    height: Math.max(
      0.05,
      curve(before.height, from.height, to.height, after.height),
    ),
    rotation: curve(
      nearestAngle(from.rotation, before.rotation),
      from.rotation,
      endAngle,
      nearestAngle(endAngle, after.rotation),
    ),
  };
}

export function moveActorPathPoint(
  path: ActorPath,
  index: number,
  point: { x: number; z: number },
): ActorPath {
  if (index === path.waypoints.length)
    return { ...path, end: { ...path.end, ...point } };
  return {
    ...path,
    waypoints: path.waypoints.map((waypoint, i) =>
      i === index ? { ...waypoint, ...point } : waypoint,
    ),
  };
}

export function addActorWaypoint(path: ActorPath, point: ActorMark): ActorPath {
  const legs = path.legs;
  const final = legs?.at(-1);
  return {
    ...path,
    waypoints: [...path.waypoints, point],
    legs:
      legs && final
        ? [
            ...legs.slice(0, -1),
            { ...final, weight: final.weight / 2 },
            { ...final, weight: final.weight / 2 },
          ]
        : undefined,
  };
}

export function removeActorWaypoint(path: ActorPath, index: number): ActorPath {
  const legs = path.legs;
  return {
    ...path,
    waypoints: path.waypoints.filter((_, i) => i !== index),
    legs: legs
      ? [
          ...legs.slice(0, index),
          {
            ...legs[index],
            weight: legs[index].weight + legs[index + 1].weight,
          },
          ...legs.slice(index + 2),
        ]
      : undefined,
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
  if (
    !wall ||
    wallOpenings(wall).some((opening) => opening.type === "window") ||
    wall.roomExtended
  )
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
  const nearestEdge = items
    .filter((item) => item.kind === "wall" && !item.hidden)
    .reduce<{ point: { x: number; z: number }; distance: number } | undefined>(
      (best, wall) => {
        const [start, end] = wallEndpoints(wall);
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.z - start.z) * dz) /
              (dx * dx + dz * dz),
          ),
        );
        const snappedDistance = Math.round(t * wall.width * 4) / 4;
        const fraction = snappedDistance / wall.width;
        const projected = {
          x: start.x + fraction * dx,
          z: start.z + fraction * dz,
        };
        const distance = Math.hypot(
          projected.x - point.x,
          projected.z - point.z,
        );
        return !best || distance < best.distance
          ? { point: projected, distance }
          : best;
      },
      undefined,
    );
  if (nearestEdge && nearestEdge.distance <= tolerance)
    return nearestEdge.point;
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
  const reverseCamera = {
    ...makeItem("camera", 2),
    name: "Camera B · reverse",
    x: 2.3,
    z: 1.2,
    rotation: 55,
    height: 1.5,
    focalLength: 35,
    focusDistance: 3.5,
  };
  const power = {
    ...makeItem("power", 1),
    name: "Set distro",
    x: -3.2,
    z: 1.9,
  };
  const leftWall = {
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
  };
  const actorA = {
    ...makeItem("actor", 1),
    name: "Mara",
    x: -0.65,
    z: -0.8,
    rotation: -140,
  };
  const actorB = {
    ...makeItem("actor", 2),
    name: "Eli",
    x: 0.8,
    z: -0.65,
    rotation: 140,
  };
  const baseItems: SceneItem[] = [
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
    leftWall,
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
      x: 0,
      z: 2.6,
      width: 8,
      opening: {
        type: "door" as const,
        offset: 1.35,
        width: 5.3,
        height: 2.6,
        sill: 0,
      },
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
    { ...makeItem("table", 2), name: "Side room desk", x: -5.7, z: -1.5 },
    { ...makeItem("chair", 2), name: "Desk chair", x: -5.6, z: -0.35 },
    { ...makeItem("plant", 2), name: "Side room plant", x: -6.7, z: -2.6 },
    actorA,
    actorB,
    {
      ...camera,
      x: 0.1,
      z: 5.1,
      height: 1.2,
      rotation: 0,
      focalLength: 50,
      focusDistance: 5.5,
    },
    reverseCamera,
    power,
    {
      ...makeItem("light", 1),
      name: "Key · softbox",
      x: -2.7,
      z: 1.1,
      rotation: -28,
      height: 2.75,
      powerSourceId: power.id,
    },
    {
      ...makeItem("light", 2),
      name: "Fill · softbox",
      x: 2.8,
      z: 1.35,
      rotation: 30,
      height: 2.35,
      intensity: 1.3,
      powerSourceId: power.id,
    },
  ];
  const items = extendRoom(baseItems, leftWall.id, 3.2);
  const shot = {
    id: id(),
    title: "Camera A · two-shot",
    cameraId: camera.id,
    notes: "Establish the room and both actors.",
    setup: "Living room A",
    status: "ready" as const,
    duration: 5,
    aspectRatio: "16:9" as AspectRatio,
    actorActions: {
      [actorA.id]: { id: "talking" as const, loop: true, speed: 1 },
      [actorB.id]: { id: "listening" as const, loop: true, speed: 1 },
    },
  };
  const reverseShot: Shot = {
    id: id(),
    title: "Camera B · reverse",
    cameraId: reverseCamera.id,
    notes: "Compare the reverse angle across the conversation.",
    setup: "Living room B",
    status: "planned",
    duration: 5,
    aspectRatio: "16:9",
    actorActions: {
      [actorA.id]: { id: "listening", loop: true, speed: 1 },
      [actorB.id]: { id: "talking", loop: true, speed: 1 },
    },
  };
  return {
    id: id(),
    name: "The Conversation · Interior",
    items,
    shots: [shot, reverseShot],
    shootOrder: [shot.id, reverseShot.id],
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

export function backlotScene(): SetScene {
  const camera = {
    ...makeItem("camera", 1),
    name: "Street camera",
    x: 0,
    z: 8.8,
    height: 1.55,
    focalLength: 24,
    focusDistance: 10,
  };
  const lead = {
    ...makeItem("actor", 1),
    name: "Lead",
    x: -1.1,
    z: 0.7,
    rotation: 15,
  };
  const supporting = {
    ...makeItem("actor", 2),
    name: "Supporting player",
    x: 1.5,
    z: -0.6,
    rotation: -25,
    mannequinPose: "greeting" as const,
  };
  const items: SceneItem[] = [
    {
      ...makeItem("ground", 1),
      name: "Main street",
      z: 1.2,
      width: 11.2,
      depth: 12,
      color: "#6f6b61",
      surfaceStyle: "road",
    },
    {
      ...makeItem("ground", 2),
      name: "Shop sidewalk",
      x: -4,
      z: -3.1,
      width: 4.4,
      depth: 2,
      color: "#b7a78b",
      surfaceStyle: "sidewalk",
    },
    {
      ...makeItem("ground", 3),
      name: "Theater sidewalk",
      x: 3.6,
      z: -3.1,
      width: 4.4,
      depth: 2,
      color: "#b7a78b",
      surfaceStyle: "sidewalk",
    },
    {
      ...makeItem("ground", 4),
      name: "Apartment sidewalk",
      x: -0.2,
      z: -3.1,
      width: 3.2,
      depth: 2,
      color: "#b7a78b",
      surfaceStyle: "sidewalk",
    },
    {
      ...makeItem("facade", 1),
      name: "Corner shop",
      x: -4,
      z: -4.6,
      width: 3.6,
      height: 3.6,
      facadeStyle: "storefront",
      color: "#c8ab78",
      signText: "CORNER MARKET",
    },
    {
      ...makeItem("facade", 2),
      name: "Brick apartment",
      x: -0.4,
      z: -5,
      width: 3.6,
      height: 4,
      facadeStyle: "brick",
      color: "#a16d59",
      signText: "THE STANLEY",
    },
    {
      ...makeItem("facade", 3),
      name: "Picture house",
      x: 3.4,
      z: -4.7,
      width: 3.8,
      height: 3.8,
      facadeStyle: "theater",
      color: "#c1a47e",
      signText: "THE PICTURE HOUSE",
    },
    {
      ...makeItem("streetlamp", 1),
      name: "Streetlight · left",
      x: -5.9,
      z: -1.5,
    },
    {
      ...makeItem("streetlamp", 2),
      name: "Streetlight · right",
      x: 5.5,
      z: -1.7,
    },
    { ...makeItem("barrel", 1), name: "Shop barrel", x: -3.4, z: -2.25 },
    {
      ...makeItem("barrel", 2),
      name: "Shop barrel · back",
      x: -4.15,
      z: -2.42,
      height: 0.82,
      color: "#a7754a",
    },
    {
      ...makeItem("bench", 1),
      name: "Street bench",
      x: 3.5,
      z: -2.1,
      rotation: 180,
    },
    lead,
    supporting,
    camera,
  ];
  const shot: Shot = {
    id: id(),
    title: "Meeting on Main Street",
    cameraId: camera.id,
    notes: "The lead crosses the street toward the picture house.",
    duration: 7,
    aspectRatio: "16:9",
    actorPaths: {
      [lead.id]: {
        waypoints: [{ x: -0.8, y: 0, z: -0.3, rotation: 25 }],
        end: { x: 0.2, y: 0, z: -1.6, rotation: 55 },
      },
    },
    actorJoints: {
      [supporting.id]: {
        ...mannequinJointsForPose("greeting"),
        headTilt: 12,
        leftArmLift: 25,
        rightElbowBend: 20,
      },
    },
  };
  return {
    id: id(),
    name: "Backlot · Main Street",
    environment: {
      ground: "asphalt",
      skyColor: "#d8bd9d",
      sunAzimuth: -45,
      sunElevation: 32,
    },
    items,
    shots: [shot],
    shootOrder: [shot.id],
  };
}
