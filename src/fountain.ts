import type { ScriptScene } from "./model.ts";

export type FountainScene = Pick<
  ScriptScene,
  "sceneNumber" | "title" | "intExt" | "timeOfDay" | "synopsis"
> & { explicitNumber: boolean };

const headingPattern =
  /^(INT\.\/EXT|INT\/EXT|EXT\/INT|INT|EXT|EST|I\/E)(?:\.|\s)\s*(.+)$/i;
const numberPattern = /\s+#([\p{L}\p{N}.-]+)#\s*$/u;

function heading(
  line: string,
  precedingBlank: boolean,
  followingBlank: boolean,
) {
  const forced = /^\.[\p{L}\p{N}]/u.test(line);
  if (!forced && !(precedingBlank && followingBlank)) return null;
  const text = forced ? line.slice(1) : line;
  const match = text.match(headingPattern);
  if (!match && !forced) return null;
  const numbered = (match ? match[2] : text).match(numberPattern);
  const body = (match ? match[2] : text).replace(numberPattern, "").trim();
  if (!body) return null;
  const parts = body.split(/\s+-\s+/);
  const time = parts.length > 1 ? parts.at(-1)!.toUpperCase() : "";
  const timeOfDay: ScriptScene["timeOfDay"] =
    time === "DAY" || time === "NIGHT" || time === "DAWN" || time === "DUSK"
      ? time
      : "OTHER";
  const title = timeOfDay === "OTHER" ? body : parts.slice(0, -1).join(" - ");
  const prefix = match?.[1].toUpperCase();
  const intExt: ScriptScene["intExt"] =
    prefix === "EXT" || prefix === "EST"
      ? "EXT"
      : prefix === "INT"
        ? "INT"
        : "INT/EXT";
  return { title, intExt, timeOfDay, sceneNumber: numbered?.[1] };
}

export function parseFountainScenes(source: string): FountainScene[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const scenes: FountainScene[] = [];
  let inBoneyard = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.startsWith("/*")) inBoneyard = true;
    if (inBoneyard) {
      if (line.includes("*/")) inBoneyard = false;
      continue;
    }
    if (!line || line.startsWith("!")) continue;
    const parsed = heading(
      line,
      index === 0 || !lines[index - 1].trim(),
      index === lines.length - 1 || !lines[index + 1].trim(),
    );
    if (parsed) {
      scenes.push({
        ...parsed,
        sceneNumber: parsed.sceneNumber ?? String(scenes.length + 1),
        explicitNumber: !!parsed.sceneNumber,
      });
    } else if (
      scenes.length &&
      line.startsWith("=") &&
      !line.startsWith("==")
    ) {
      const scene = scenes.at(-1)!;
      if (!scene.synopsis) scene.synopsis = line.slice(1).trim();
    }
  }
  return scenes;
}

export interface FountainReconciliation {
  scenes: ScriptScene[];
  added: number;
  updated: number;
  skipped: number;
  missing: number;
  reordered: boolean;
}

const sceneNumberKey = (value: string) => value.trim().toLocaleLowerCase();

export function reconcileFountainScenes(
  existing: ScriptScene[],
  incoming: FountainScene[],
  createId: () => string,
): FountainReconciliation {
  const existingByNumber = new Map<string, ScriptScene[]>();
  const incomingCounts = new Map<string, number>();
  for (const scene of existing) {
    const key = sceneNumberKey(scene.sceneNumber);
    existingByNumber.set(key, [...(existingByNumber.get(key) ?? []), scene]);
  }
  for (const scene of incoming) {
    const key = sceneNumberKey(scene.sceneNumber);
    incomingCounts.set(key, (incomingCounts.get(key) ?? 0) + 1);
  }

  const scenes: ScriptScene[] = [];
  const matched = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const scene of incoming) {
    const key = sceneNumberKey(scene.sceneNumber);
    const candidates = existingByNumber.get(key) ?? [];
    if (incomingCounts.get(key) !== 1 || candidates.length > 1) {
      skipped++;
      continue;
    }
    const prior = candidates[0];
    if (prior) {
      matched.add(prior.id);
      if (!scene.explicitNumber) {
        scenes.push(prior);
        skipped++;
        continue;
      }
      const next = {
        ...prior,
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        intExt: scene.intExt,
        timeOfDay: scene.timeOfDay,
        synopsis: scene.synopsis,
      };
      if (
        next.sceneNumber !== prior.sceneNumber ||
        next.title !== prior.title ||
        next.intExt !== prior.intExt ||
        next.timeOfDay !== prior.timeOfDay ||
        next.synopsis !== prior.synopsis
      )
        updated++;
      scenes.push(next);
    } else {
      scenes.push({
        id: createId(),
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        intExt: scene.intExt,
        timeOfDay: scene.timeOfDay,
        synopsis: scene.synopsis,
        pageEighths: 0,
        cast: [],
        props: [],
        wardrobe: [],
        effects: [],
      });
      added++;
    }
  }
  const missing = existing.filter((scene) => !matched.has(scene.id)).length;
  scenes.push(...existing.filter((scene) => !matched.has(scene.id)));
  const existingIds = new Set(existing.map((scene) => scene.id));
  const reordered = scenes
    .filter((scene) => existingIds.has(scene.id))
    .some((scene, index) => scene.id !== existing[index].id);
  return { scenes, added, updated, skipped, missing, reordered };
}
