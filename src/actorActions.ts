import type { MannequinJoints } from "./model";

export const actorActions = [
  {
    id: "talking",
    label: "Talking",
    detail: "Hands and head move in conversation",
  },
  {
    id: "listening",
    label: "Listening",
    detail: "Small nods and attentive posture",
  },
  { id: "waving", label: "Waving", detail: "Raise and wave the right arm" },
  {
    id: "looking",
    label: "Looking around",
    detail: "Scan the set with head movement",
  },
  { id: "pointing", label: "Pointing", detail: "Gesture toward the scene" },
] as const;

export type ActorActionId = (typeof actorActions)[number]["id"];

export interface ActorAction {
  id: ActorActionId;
  loop: boolean;
  speed: number;
}

export function actorActionPose(
  base: MannequinJoints,
  action: ActorAction,
  seconds: number,
): MannequinJoints {
  if (seconds <= 0) return base;
  const cycle = 2.5 / action.speed;
  if (!action.loop && seconds >= cycle) return base;
  const phase = (seconds / cycle) * Math.PI * 2;
  const envelope = action.loop
    ? Math.min(1, seconds * 3)
    : Math.sin((seconds / cycle) * Math.PI);
  const wave = Math.sin(phase);
  const next = { ...base };
  const add = (
    key: keyof MannequinJoints,
    amount: number,
    min: number,
    max: number,
  ) => {
    next[key] = Math.max(min, Math.min(max, base[key] + amount * envelope));
  };
  switch (action.id) {
    case "talking":
      add("headNod", 5 * wave, -35, 35);
      add("leftShoulderSwing", 14 * wave, -110, 110);
      add("rightShoulderSwing", -12 * wave, -110, 110);
      add("leftElbowBend", 24 + 9 * wave, 0, 145);
      add("rightElbowBend", 22 - 8 * wave, 0, 145);
      break;
    case "listening":
      add("headTilt", 7 * Math.sin(phase * 0.5), -45, 45);
      add("headNod", 5 * Math.max(0, wave), -35, 35);
      break;
    case "waving":
      add("rightArmLift", 120, 0, 160);
      add("rightElbowBend", 42 + 24 * wave, 0, 145);
      break;
    case "looking":
      add("headTilt", 18 * wave, -45, 45);
      add("headNod", 5 * Math.sin(phase * 0.5), -35, 35);
      break;
    case "pointing":
      add("rightArmLift", 75 + 5 * wave, 0, 160);
      add("headTilt", 6 * wave, -45, 45);
      break;
  }
  return next;
}
