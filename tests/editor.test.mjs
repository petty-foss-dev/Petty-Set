import test from "node:test";
import assert from "node:assert/strict";
import { historyReducer, projectHistory } from "../src/history.ts";
import { isProject, sampleProject, wallBetween } from "../src/model.ts";

test("undo restores a deleted shot and redo removes it again", () => {
  const project = sampleProject();
  const shotId = project.scenes[0].shots[0].id;
  const edited = historyReducer(projectHistory(project), {
    type: "edit",
    update: (current) => ({
      ...current,
      scenes: [{ ...current.scenes[0], shots: [], shootOrder: [] }],
    }),
  });
  const restored = historyReducer(edited, { type: "undo" });
  assert.equal(restored.present.scenes[0].shots[0].id, shotId);
  assert.deepEqual(restored.present.scenes[0].shootOrder, [shotId]);
  assert.equal(
    historyReducer(restored, { type: "redo" }).present.scenes[0].shots.length,
    0,
  );
});

test("a new edit after undo clears the redo branch", () => {
  const first = historyReducer(projectHistory(sampleProject()), {
    type: "edit",
    update: (project) => ({ ...project, name: "First" }),
  });
  const undone = historyReducer(first, { type: "undo" });
  const branched = historyReducer(undone, {
    type: "edit",
    update: (project) => ({ ...project, name: "Second" }),
  });
  assert.equal(branched.present.name, "Second");
  assert.equal(branched.future.length, 0);
});

test("drawn walls preserve world-space endpoints", () => {
  const wall = wallBetween({ x: 1, z: 2 }, { x: 1, z: -2 }, 1);
  assert.equal(wall.x, 1);
  assert.equal(wall.z, 0);
  assert.equal(wall.width, 4);
  assert.equal(wall.rotation, 90);
});

test("project import rejects broken camera and actor references", () => {
  const project = sampleProject();
  assert.equal(isProject(project), true);
  const missingCamera = structuredClone(project);
  missingCamera.scenes[0].shots[0].cameraId = "missing";
  assert.equal(isProject(missingCamera), false);
  const missingActor = structuredClone(project);
  missingActor.scenes[0].shots[0].actorMarks = {
    missing: { x: 0, y: 0, z: 0, rotation: 0 },
  };
  assert.equal(isProject(missingActor), false);
});
