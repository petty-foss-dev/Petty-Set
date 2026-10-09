import test from "node:test";
import assert from "node:assert/strict";
import { historyReducer, projectHistory } from "../src/history.ts";
import {
  isProject,
  extendRoom,
  sampleProject,
  snapWallPoint,
  wallBetween,
  wallEndpoints,
  actorPoseAt,
  outdoorScene,
  backlotScene,
  mannequinJointsForPose,
  mannequinPoseForJoints,
} from "../src/model.ts";
import { cameraOptics } from "../src/cinematography.ts";
import { shotListCSV } from "../src/shotList.ts";
import { actorActionPose } from "../src/actorActions.ts";

test("undo restores a deleted shot and redo removes it again", () => {
  const project = sampleProject();
  const shotId = project.scenes[0].shots[0].id;
  const originalOrder = [...project.scenes[0].shootOrder];
  const edited = historyReducer(projectHistory(project), {
    type: "edit",
    update: (current) => ({
      ...current,
      scenes: [{ ...current.scenes[0], shots: [], shootOrder: [] }],
    }),
  });
  const restored = historyReducer(edited, { type: "undo" });
  assert.equal(restored.present.scenes[0].shots[0].id, shotId);
  assert.deepEqual(restored.present.scenes[0].shootOrder, originalOrder);
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

test("wall drawing snaps to rotated wall endpoints before the grid", () => {
  const wall = wallBetween({ x: 1, z: 2 }, { x: 1, z: -2 }, 1);
  const endpoints = wallEndpoints(wall);
  assert.ok(Math.abs(endpoints[0].x - 1) < 1e-9);
  assert.ok(Math.abs(endpoints[0].z - 2) < 1e-9);
  assert.ok(Math.abs(endpoints[1].x - 1) < 1e-9);
  assert.ok(Math.abs(endpoints[1].z + 2) < 1e-9);
  const snapped = snapWallPoint({ x: 1.28, z: -1.8 }, [wall]);
  assert.ok(Math.abs(snapped.x - 1) < 1e-9);
  assert.ok(Math.abs(snapped.z + 2) < 1e-9);
  assert.deepEqual(snapWallPoint({ x: 2.38, z: 1.12 }, [wall]), {
    x: 2.5,
    z: 1,
  });
});

test("extending a wall creates a connected second room and doorway", () => {
  const scene = sampleProject().scenes[0];
  const source = scene.items.find((item) => item.name === "Right wall");
  const extended = extendRoom(scene.items, source.id);
  assert.equal(extended.length, scene.items.length + 3);
  assert.equal(
    extended.find((item) => item.id === source.id).opening.type,
    "door",
  );
  const originalEnds = wallEndpoints(source);
  const sideEnds = wallEndpoints(extended.at(-3));
  assert.ok(
    sideEnds.some((point) =>
      originalEnds.some(
        (end) => Math.hypot(point.x - end.x, point.z - end.z) < 1e-8,
      ),
    ),
  );
  scene.items = extended;
  assert.equal(isProject({ version: 1, name: "Test", scenes: [scene] }), true);
});

test("camera paths require finite end coordinates and positive height", () => {
  const project = sampleProject();
  project.scenes[0].shots[0].cameraEnd = {
    x: 4,
    z: -3,
    height: 1.4,
    rotation: 90,
  };
  project.scenes[0].shots[0].cameraWaypoints = [
    { x: 2, z: 0, height: 1.2, rotation: 30 },
  ];
  assert.equal(isProject(project), true);
  project.scenes[0].shots[0].cameraWaypoints[0].height = -1;
  assert.equal(isProject(project), false);
});

test("actor movement follows waypoints and turns by the short arc", () => {
  const start = { x: 0, y: 0, z: 0, rotation: 350 };
  const path = {
    waypoints: [{ x: 2, y: 0, z: -1, rotation: 10 }],
    end: { x: 4, y: 0, z: -3, rotation: 90 },
  };
  assert.deepEqual(actorPoseAt(start, path, 0), start);
  assert.deepEqual(actorPoseAt(start, path, 0.25), {
    x: 1,
    y: 0,
    z: -0.5,
    rotation: 360,
  });
  assert.deepEqual(actorPoseAt(start, path, 0.5), {
    x: 2,
    y: 0,
    z: -1,
    rotation: 10,
  });
  assert.deepEqual(actorPoseAt(start, path, 1), {
    x: 4,
    y: 0,
    z: -3,
    rotation: 90,
  });
});

test("outdoor scene and actor routes survive project validation", () => {
  const scene = outdoorScene();
  const project = { version: 1, name: "Exterior", scenes: [scene] };
  assert.equal(isProject(project), true);
  const invalid = structuredClone(project);
  const actorId = Object.keys(invalid.scenes[0].shots[0].actorPaths)[0];
  invalid.scenes[0].shots[0].actorPaths[actorId].end.x = Infinity;
  assert.equal(isProject(invalid), false);
  const badSky = structuredClone(project);
  badSky.scenes[0].environment.skyColor = "blue";
  assert.equal(isProject(badSky), false);
});

test("backlot preset keeps editable facade styles and actor route valid", () => {
  const scene = backlotScene();
  const project = { version: 1, name: "Backlot", scenes: [scene] };
  assert.equal(isProject(project), true);
  assert.deepEqual(
    scene.items
      .filter((item) => item.kind === "facade")
      .map((item) => item.facadeStyle),
    ["storefront", "brick", "theater"],
  );
  const supporting = scene.items.find(
    (item) => item.name === "Supporting player",
  );
  assert.equal(scene.shots[0].actorJoints[supporting.id].headTilt, 12);
  const invalid = structuredClone(project);
  invalid.scenes[0].items.find((item) => item.kind === "facade").facadeStyle =
    "castle";
  assert.equal(isProject(invalid), false);
  const invalidSign = structuredClone(project);
  invalidSign.scenes[0].items.find((item) => item.kind === "facade").signText =
    "A".repeat(25);
  assert.equal(isProject(invalidSign), false);
  const invalidSurface = structuredClone(project);
  invalidSurface.scenes[0].items.find(
    (item) => item.kind === "ground",
  ).surfaceStyle = "water";
  assert.equal(isProject(invalidSurface), false);
  assert.equal(
    scene.items.find((item) => item.name === "Supporting player").mannequinPose,
    "greeting",
  );
  const invalidPose = structuredClone(project);
  invalidPose.scenes[0].items.find(
    (item) => item.kind === "actor",
  ).mannequinPose = "flying";
  assert.equal(isProject(invalidPose), false);
});

test("mannequin joints are saved per shot and validated", () => {
  const project = sampleProject();
  const scene = project.scenes[0];
  const actor = scene.items.find((item) => item.kind === "actor");
  const greeting = mannequinJointsForPose("greeting");
  assert.equal(mannequinPoseForJoints(greeting), "greeting");
  scene.shots[0].actorJoints = { [actor.id]: greeting };
  const secondShot = {
    ...structuredClone(scene.shots[0]),
    id: "second-shot",
    actorJoints: { [actor.id]: mannequinJointsForPose("neutral") },
  };
  scene.shots.push(secondShot);
  scene.shootOrder.push(secondShot.id);
  assert.equal(isProject(project), true);
  assert.equal(scene.shots.at(-1).actorJoints[actor.id].rightArmLift, 0);
  const invalid = structuredClone(project);
  invalid.scenes[0].shots[0].actorJoints[actor.id].rightArmLift = 220;
  assert.equal(isProject(invalid), false);
  const orphan = structuredClone(project);
  orphan.scenes[0].shots[0].actorJoints.missing =
    mannequinJointsForPose("pointing");
  assert.equal(isProject(orphan), false);
});

test("furnished set connects two camera setups, actor actions, and power", () => {
  const project = sampleProject();
  const scene = project.scenes[0];
  assert.equal(isProject(project), true);
  assert.equal(scene.shots.length, 2);
  assert.notEqual(scene.shots[0].cameraId, scene.shots[1].cameraId);
  assert.ok(scene.items.some((item) => item.kind === "power"));
  assert.equal(
    scene.items.filter((item) => item.kind === "light" && item.powerSourceId)
      .length,
    2,
  );
  const action = Object.values(scene.shots[0].actorActions)[0];
  const neutral = mannequinJointsForPose("neutral");
  assert.deepEqual(actorActionPose(neutral, action, 0), neutral);
  assert.notDeepEqual(actorActionPose(neutral, action, 0.6), neutral);
  const invalidAction = structuredClone(project);
  Object.values(invalidAction.scenes[0].shots[0].actorActions)[0].speed = 9;
  assert.equal(isProject(invalidAction), false);
  const brokenPower = structuredClone(project);
  brokenPower.scenes[0].items.find(
    (item) => item.kind === "light",
  ).powerSourceId = "missing";
  assert.equal(isProject(brokenPower), false);
});

test("project import rejects asset data without a GLB 2 header", () => {
  const project = sampleProject();
  project.scenes[0].items.push({
    ...project.scenes[0].items[0],
    id: "asset-1",
    kind: "asset",
    opening: undefined,
    assetData: "data:model/gltf-binary;base64,AAAA",
  });
  assert.equal(isProject(project), false);
});

test("project import validates floor plan placement", () => {
  const project = sampleProject();
  project.scenes[0].floorplan = "data:image/png;base64,AA==";
  project.scenes[0].floorplanPlacement = {
    x: 1,
    z: -2,
    width: 8,
    height: 6,
    rotation: 15,
    opacity: 0.5,
  };
  assert.equal(isProject(project), true);
  project.scenes[0].floorplanPlacement.width = -1;
  assert.equal(isProject(project), false);
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

test("sensor and delivery aspect change the effective field of view", () => {
  const s35 = cameraOptics("super35", 35, 2.8, 3, "16:9");
  const fullFrame = cameraOptics("fullFrame", 35, 2.8, 3, "16:9");
  const widescreen = cameraOptics("super35", 35, 2.8, 3, "2.39:1");
  assert.ok(fullFrame.horizontalFov > s35.horizontalFov);
  assert.ok(widescreen.verticalFov < s35.verticalFov);
  assert.ok(s35.nearFocus < 3 && s35.farFocus > 3);
});

test("shot list CSV preserves order and escapes production notes", () => {
  const scene = sampleProject().scenes[0];
  scene.shots[0].notes = 'Move to "door", then hold\nfor cue';
  const csv = shotListCSV(scene, scene.shots);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Move to ""door"", then hold\nfor cue"'));
  assert.ok(csv.includes('"Super 35","50","2.8","5.5","16:9"'));
});
