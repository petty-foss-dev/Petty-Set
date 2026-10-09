import type { Project } from "./model";

const HEADINGS = [
  "Project",
  "Scene number",
  "Scene title",
  "INT/EXT",
  "Time of day",
  "Set",
  "Page eighths",
  "Shot count",
  "Cast",
  "Props",
  "Wardrobe",
  "Effects",
  "Synopsis",
  "Notes",
];

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function scriptBreakdownCSV(project: Project): string {
  const setNames = new Map(
    project.scenes.map((scene) => [scene.id, scene.name]),
  );
  const shotCounts = new Map<string, number>();
  for (const set of project.scenes) {
    for (const shot of set.shots) {
      if (!shot.scriptSceneId) continue;
      shotCounts.set(
        shot.scriptSceneId,
        (shotCounts.get(shot.scriptSceneId) ?? 0) + 1,
      );
    }
  }

  const rows: (string | number)[][] = [HEADINGS];
  for (const scene of project.scriptScenes ?? []) {
    rows.push([
      project.name,
      scene.sceneNumber,
      scene.title,
      scene.intExt,
      scene.timeOfDay,
      scene.setSceneId ? (setNames.get(scene.setSceneId) ?? "") : "",
      scene.pageEighths ?? "",
      shotCounts.get(scene.id) ?? 0,
      scene.cast.join("; "),
      scene.props.join("; "),
      scene.wardrobe.join("; "),
      scene.effects.join("; "),
      scene.synopsis ?? "",
      scene.notes ?? "",
    ]);
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
