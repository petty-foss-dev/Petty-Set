import type { Project } from "./model";

export interface ProjectHistory {
  past: Project[];
  present: Project;
  future: Project[];
}

export type HistoryAction =
  | { type: "edit"; update: (project: Project) => Project }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; project: Project };

export function projectHistory(project: Project): ProjectHistory {
  return { past: [], present: project, future: [] };
}

export function historyReducer(
  history: ProjectHistory,
  action: HistoryAction,
): ProjectHistory {
  switch (action.type) {
    case "edit": {
      const next = action.update(history.present);
      if (next === history.present) return history;
      return {
        past: [...history.past.slice(-49), history.present],
        present: next,
        future: [],
      };
    }
    case "undo": {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      };
    }
    case "redo": {
      const next = history.future[0];
      if (!next) return history;
      return {
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      };
    }
    case "replace":
      return projectHistory(action.project);
  }
}
