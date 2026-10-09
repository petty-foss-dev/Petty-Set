import type { Project } from "./model.ts";

export interface CastScheduleConflict {
  date: string;
  castMember: string;
  units: string[];
}

export function castScheduleConflicts(
  project: Project,
): CastScheduleConflict[] {
  const scenes = new Map(
    (project.scriptScenes ?? []).map((scene) => [scene.id, scene]),
  );
  const assignments = new Map<
    string,
    { date: string; castMember: string; units: Set<string> }
  >();
  for (const day of project.shootDays ?? []) {
    for (const sceneId of day.scriptSceneIds) {
      const scene = scenes.get(sceneId);
      if (!scene) continue;
      for (const castMember of scene.cast) {
        const key = `${day.date}\u0000${castMember.trim().toLocaleLowerCase()}`;
        const assignment = assignments.get(key) ?? {
          date: day.date,
          castMember: castMember.trim(),
          units: new Set<string>(),
        };
        assignment.units.add(day.unit);
        assignments.set(key, assignment);
      }
    }
  }
  return [...assignments.values()]
    .filter((assignment) => assignment.units.size > 1)
    .map(({ date, castMember, units }) => ({
      date,
      castMember,
      units: [...units].sort(),
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.castMember.localeCompare(b.castMember),
    );
}

export function shootScheduleCSV(project: Project): string {
  const scenes = new Map(
    (project.scriptScenes ?? []).map((scene) => [scene.id, scene]),
  );
  const sets = new Map(project.scenes.map((set) => [set.id, set.name]));
  const rows: (string | number)[][] = [
    [
      "Date",
      "Unit",
      "Call time",
      "Scene number",
      "Scene title",
      "INT/EXT",
      "Time of day",
      "Set",
      "Page eighths",
      "Cast",
      "Day notes",
    ],
  ];
  const scheduled = new Set<string>();
  for (const day of [...(project.shootDays ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.unit.localeCompare(b.unit),
  )) {
    for (const sceneId of day.scriptSceneIds) {
      const scene = scenes.get(sceneId);
      if (!scene) continue;
      scheduled.add(sceneId);
      rows.push([
        day.date,
        day.unit,
        day.callTime ?? "",
        scene.sceneNumber,
        scene.title,
        scene.intExt,
        scene.timeOfDay,
        scene.setSceneId ? (sets.get(scene.setSceneId) ?? "") : "",
        scene.pageEighths,
        scene.cast.join("; "),
        day.notes ?? "",
      ]);
    }
  }
  for (const scene of project.scriptScenes ?? []) {
    if (scheduled.has(scene.id)) continue;
    rows.push([
      "",
      "Unscheduled",
      "",
      scene.sceneNumber,
      scene.title,
      scene.intExt,
      scene.timeOfDay,
      scene.setSceneId ? (sets.get(scene.setSceneId) ?? "") : "",
      scene.pageEighths,
      scene.cast.join("; "),
      "",
    ]);
  }
  return `${rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value);
          return /[",\r\n]/.test(cell)
            ? `"${cell.replaceAll('"', '""')}"`
            : cell;
        })
        .join(","),
    )
    .join("\r\n")}\r\n`;
}
