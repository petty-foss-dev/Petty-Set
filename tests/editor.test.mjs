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
import {
  fixtureLumens,
  floorIlluminance,
  lightAimPoint,
  sampleFloorIlluminance,
  traceFloor,
} from "../src/lighting.ts";
import {
  lightingSnapshot,
  resolveLightingPlan,
  updateLightingFixture,
} from "../src/lightingPlans.ts";
import { shootDaySVG } from "../src/shootDay.ts";
import { zipFiles } from "../src/zip.ts";
import {
  floorplanSVG,
  canSplitWall,
  calibratedPlacement,
  insertPlanWall,
  moveSharedCorner,
  planRooms,
  rectangularRoom,
  splitWall,
} from "../src/floorplan.ts";

test("rectangular rooms share walls and report enclosed floor area", () => {
  const first = rectangularRoom([], { x: 0, z: 0 }, { x: 4, z: 3 });
  assert.equal(first.length, 4);
  assert.equal(planRooms(first)[0].area, 12);
  const adjacent = rectangularRoom(first, { x: 4, z: 0 }, { x: 7, z: 3 });
  assert.equal(adjacent.length, 7);
  assert.deepEqual(
    planRooms(adjacent)
      .map((room) => room.area)
      .sort((a, b) => a - b),
    [9, 12],
  );
  const moved = moveSharedCorner(first, { x: 0, z: 0 }, { x: -1, z: 0 });
  assert.equal(
    moved.filter((wall, index) => wall.width !== first[index].width).length,
    2,
  );
  assert.equal(planRooms(moved)[0].area, 13.5);
});

test("floor plan export includes room area, openings and scale", () => {
  const scene = sampleProject().scenes[0];
  assert.deepEqual(
    planRooms(scene.items)
      .map((room) => room.area)
      .sort((a, b) => a - b),
    [19.2, 48],
  );
  const svg = floorplanSVG(scene);
  assert.match(svg, /Room 1 · 48\.0 m²/);
  assert.match(svg, /1 m<\/text>/);
  assert.match(svg, /stroke="#5490a3"/);
});

test("two-point calibration scales an imported plan uniformly", () => {
  const placement = {
    x: 0,
    z: 0,
    width: 10,
    height: 6,
    rotation: 0,
    opacity: 0.6,
  };
  const calibrated = calibratedPlacement(
    placement,
    { x: 1, z: 1 },
    { x: 3, z: 1 },
    5,
  );
  assert.equal(calibrated.width, 25);
  assert.equal(calibrated.height, 15);
  assert.equal(calibrated.opacity, 0.6);
  assert.equal(
    calibratedPlacement(placement, { x: 1, z: 1 }, { x: 1, z: 1 }, 5),
    placement,
  );
});

test("splitting a wall preserves an offset opening and room area", () => {
  const items = rectangularRoom([], { x: 0, z: 0 }, { x: 6, z: 4 });
  const wall = {
    ...items[0],
    opening: { type: "window", offset: -1.5, width: 1, height: 1, sill: 1 },
  };
  const sceneItems = [wall, ...items.slice(1)];
  assert.equal(canSplitWall(wall), true);
  const split = splitWall(sceneItems, wall.id);
  assert.equal(split.length, 5);
  assert.equal(split[0].opening.offset, 0);
  assert.equal(split[1].opening, undefined);
  assert.equal(planRooms(split)[0].area, 24);
  assert.equal(
    canSplitWall({ ...wall, opening: { ...wall.opening, offset: 0 } }),
    false,
  );
});

test("interior partitions split wall intersections into measured rooms", () => {
  const perimeter = rectangularRoom([], { x: 0, z: 0 }, { x: 4, z: 3 });
  assert.deepEqual(snapWallPoint({ x: 2.1, z: 0.2 }, perimeter), {
    x: 2,
    z: 0,
  });
  const partition = wallBetween({ x: 2, z: 0 }, { x: 2, z: 3 }, 5);
  const items = insertPlanWall(perimeter, partition);
  assert.equal(items.length, 7);
  assert.deepEqual(
    planRooms(items)
      .map((room) => room.area)
      .sort((a, b) => a - b),
    [6, 6],
  );
});

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

test("shot references survive project import validation", () => {
  const project = sampleProject();
  project.scenes[0].shots[0].reference = {
    name: "board-01.jpg",
    image: "data:image/jpeg;base64,/9j/",
  };
  assert.equal(isProject(project), true);
  const invalid = structuredClone(project);
  invalid.scenes[0].shots[0].reference.image = "https://example.com/board.jpg";
  assert.equal(isProject(invalid), false);
});

test("shot planning status and setup validate without breaking older projects", () => {
  const project = sampleProject();
  assert.equal(isProject(project), true);
  delete project.scenes[0].shots[0].status;
  delete project.scenes[0].shots[0].setup;
  assert.equal(isProject(project), true);
  project.scenes[0].shots[0].status = "complete";
  assert.equal(isProject(project), false);
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
  assert.ok(csv.includes('"Setup","Status"'));
  assert.ok(csv.includes('"Living room A","ready"'));
  assert.ok(csv.includes('"Move to ""door"", then hold\nfor cue"'));
  assert.ok(csv.includes('"Super 35","50","2.8","5.5","16:9"'));
});

test("direct light trace follows falloff, beam aim and wall openings", () => {
  const light = {
    ...sampleProject().scenes[0].items.find((item) => item.kind === "light"),
    x: 0,
    y: 0,
    z: 0,
    height: 2,
    rotation: 0,
    tilt: 90,
    lightType: "spot",
    spread: 40,
    lumens: 1000,
  };
  const aim = lightAimPoint(light);
  assert.ok(Math.abs(aim.x) < 1e-8 && Math.abs(aim.z) < 1e-8);
  assert.ok(floorIlluminance(light, aim, []) > 0);
  assert.equal(floorIlluminance(light, { x: 4, z: 0 }, []), 0);
  const practical = { ...light, lightType: "practical" };
  assert.ok(
    floorIlluminance(practical, { x: 0, z: 0 }, []) >
      floorIlluminance(practical, { x: 4, z: 0 }, []) * 10,
  );
  const wall = wallBetween({ x: 1, z: -1 }, { x: 1, z: 1 }, 1);
  practical.x = 0;
  assert.equal(floorIlluminance(practical, { x: 2, z: 0 }, [wall]), 0);
  wall.opening = { type: "door", offset: 0, width: 1, height: 2, sill: 0 };
  assert.ok(floorIlluminance(practical, { x: 2, z: 0 }, [wall]) > 0);
  wall.opening = {
    type: "window",
    offset: 0,
    width: 1,
    height: 0.5,
    sill: 1.5,
  };
  assert.equal(floorIlluminance(practical, { x: 2, z: 0 }, [wall]), 0);
  assert.ok(traceFloor([practical, wall]).values.some((lux) => lux > 0));
});

test("light meter totals visible fixtures and reports occluded contributions", () => {
  const base = sampleProject().scenes[0].items.find(
    (item) => item.kind === "light",
  );
  const near = {
    ...base,
    id: "near",
    name: "Near",
    x: 0,
    z: 0,
    y: 0,
    height: 2,
    lightType: "practical",
    lumens: 1000,
  };
  const far = { ...near, id: "far", name: "Far", x: 3 };
  const hidden = { ...near, id: "hidden", hidden: true };
  const point = { x: 0, z: 0 };
  const reading = sampleFloorIlluminance([far, hidden, near], point);
  assert.deepEqual(
    reading.contributors.map((light) => light.name),
    ["Near", "Far"],
  );
  assert.equal(
    reading.total,
    reading.contributors[0].lux + reading.contributors[1].lux,
  );
  const wall = wallBetween({ x: 1, z: -1 }, { x: 1, z: 1 }, 1);
  const blocked = sampleFloorIlluminance([near, far, wall], point);
  assert.equal(blocked.contributors.find((light) => light.id === "far").lux, 0);
  assert.equal(
    blocked.total,
    blocked.contributors.find((light) => light.id === "near").lux,
  );
});

test("shot lighting plans keep alternatives independent through project export", () => {
  const project = sampleProject();
  const scene = project.scenes[0];
  const shot = scene.shots[0];
  const light = scene.items.find((item) => item.kind === "light");
  const baseLumens = light.lumens ?? (light.intensity ?? 2) * 600;
  const first = {
    id: "plan-a",
    name: "Plan A",
    fixtures: lightingSnapshot(scene.items),
  };
  const second = updateLightingFixture(
    { ...first, id: "plan-b", name: "Plan B" },
    light,
    { lumens: baseLumens + 500, x: light.x + 2 },
  );
  shot.lightingPlans = [first, second];
  shot.activeLightingPlanId = second.id;
  assert.equal(
    resolveLightingPlan(scene, shot).items.find((item) => item.id === light.id)
      .lumens,
    baseLumens + 500,
  );
  assert.equal(scene.items.find((item) => item.id === light.id).x, light.x);
  shot.activeLightingPlanId = first.id;
  assert.equal(
    resolveLightingPlan(scene, shot).items.find((item) => item.id === light.id)
      .x,
    light.x,
  );
  assert.ok(isProject(JSON.parse(JSON.stringify(project))));
  shot.activeLightingPlanId = "missing";
  assert.equal(isProject(project), false);
  shot.activeLightingPlanId = first.id;
  first.fixtures[scene.items.find((item) => item.kind === "camera").id] = {
    lumens: 500,
  };
  assert.equal(isProject(project), false);
});

test("shot sheet uses the active lighting alternative", () => {
  const project = sampleProject();
  const scene = project.scenes[0];
  const shot = scene.shots[0];
  const light = scene.items.find((item) => item.kind === "light");
  const plan = updateLightingFixture(
    { id: "plan-b", name: "Plan B", fixtures: lightingSnapshot(scene.items) },
    light,
    { lumens: 1800 },
  );
  shot.lightingPlans = [plan];
  shot.activeLightingPlanId = plan.id;
  const svg = shootDaySVG("Film & crew", scene, shot);
  assert.match(svg, /Film &amp; crew/);
  assert.match(svg, /Plan B/);
  assert.match(svg, /1800 lm/);
});

test("batch PNG archive writes valid ZIP headers and CRC", () => {
  const archive = zipFiles([
    { name: "shot.png", bytes: new TextEncoder().encode("123456789") },
  ]);
  const view = new DataView(archive.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(archive.length - 12, true), 1);
});

test("fixture photometry rejects invalid output and tilt", () => {
  const project = sampleProject();
  const light = project.scenes[0].items.find((item) => item.kind === "light");
  const fill = project.scenes[0].items.find(
    (item) => item.name === "Fill · softbox",
  );
  assert.equal(fixtureLumens(fill), 780);
  light.lumens = 1800;
  light.tilt = 65;
  assert.equal(isProject(project), true);
  light.lumens = -1;
  assert.equal(isProject(project), false);
  light.lumens = 1800;
  light.tilt = 120;
  assert.equal(isProject(project), false);
});
