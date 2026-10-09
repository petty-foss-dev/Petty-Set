import type { ScriptScene } from "./model.ts";

export type FountainScene = Pick<
  ScriptScene,
  "sceneNumber" | "title" | "intExt" | "timeOfDay" | "synopsis"
>;

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
