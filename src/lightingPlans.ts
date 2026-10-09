import type { SceneItem, SetScene, Shot, ShotLightingPlan } from "./model.ts";

const fields = [
  "x",
  "y",
  "z",
  "rotation",
  "height",
  "intensity",
  "lumens",
  "sourceSize",
  "tilt",
  "spread",
  "color",
  "lightType",
  "powerWatts",
  "powerSourceId",
  "hidden",
] as const;

export function lightingSnapshot(
  items: SceneItem[],
): ShotLightingPlan["fixtures"] {
  return Object.fromEntries(
    items
      .filter((item) => item.kind === "light")
      .map((item) => [
        item.id,
        Object.fromEntries(
          fields
            .filter((field) => item[field] !== undefined)
            .map((field) => [field, item[field]]),
        ),
      ]),
  );
}

export function resolveLightingPlan(scene: SetScene, shot?: Shot): SetScene {
  const plan = shot?.lightingPlans?.find(
    (entry) => entry.id === shot.activeLightingPlanId,
  );
  if (!plan) return scene;
  return {
    ...scene,
    items: scene.items.map((item) => {
      if (item.kind !== "light") return item;
      const fixture = plan.fixtures[item.id];
      if (!fixture) return item;
      return {
        ...item,
        ...fixture,
        powerSourceId:
          fixture.powerSourceId === null
            ? undefined
            : (fixture.powerSourceId ?? item.powerSourceId),
      };
    }),
  };
}

export function updateLightingFixture(
  plan: ShotLightingPlan,
  item: SceneItem,
  patch: Partial<SceneItem>,
): ShotLightingPlan {
  const current = plan.fixtures[item.id] ?? lightingSnapshot([item])[item.id];
  const fixture = { ...current };
  for (const field of fields) {
    if (field in patch) {
      (fixture as Record<string, unknown>)[field] =
        field === "powerSourceId"
          ? (patch.powerSourceId ?? null)
          : patch[field];
    }
  }
  return {
    ...plan,
    fixtures: { ...plan.fixtures, [item.id]: fixture },
  };
}
