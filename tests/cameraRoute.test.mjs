import test from "node:test";
import assert from "node:assert/strict";
import {
  actorRouteCollisions,
  cameraRouteCollisions,
} from "../src/cameraRoute.ts";
import { makeItem, wallBetween } from "../src/model.ts";

test("camera routes flag solid walls and clear a wide doorway", () => {
  const wall = wallBetween({ x: 0, z: 0 }, { x: 4, z: 0 }, 1);
  const camera = { ...makeItem("camera", 1), x: 2, z: -2, height: 1.5 };
  const shot = {
    cameraEnd: { x: 2, z: 2, height: 1.5, rotation: 0 },
  };
  assert.deepEqual(
    cameraRouteCollisions(camera, shot, [wall]).map((hit) => hit.wallId),
    [wall.id],
  );
  wall.opening = { type: "door", offset: 0, width: 1.2, sill: 0, height: 2.2 };
  assert.deepEqual(cameraRouteCollisions(camera, shot, [wall]), []);
  wall.opening.width = 0.3;
  assert.equal(cameraRouteCollisions(camera, shot, [wall]).length, 1);
  wall.hidden = true;
  assert.deepEqual(cameraRouteCollisions(camera, shot, [wall]), []);
});

test("camera routes respect wall height and smooth curved paths", () => {
  const wall = wallBetween({ x: 0, z: 0 }, { x: 4, z: 0 }, 1);
  const camera = { ...makeItem("camera", 1), x: 2, z: -2, height: 3.5 };
  const shot = {
    cameraMoveStyle: "smooth",
    cameraWaypoints: [{ x: 2.5, z: 0, height: 3.5, rotation: 0 }],
    cameraEnd: { x: 2, z: 2, height: 3.5, rotation: 0 },
  };
  assert.deepEqual(cameraRouteCollisions(camera, shot, [wall]), []);
  shot.cameraWaypoints[0].height = 1.5;
  assert.equal(cameraRouteCollisions(camera, shot, [wall]).length, 1);
});

test("actor routes require a doorway wide and tall enough for the performer", () => {
  const wall = wallBetween({ x: 0, z: 0 }, { x: 4, z: 0 }, 1);
  const actor = { ...makeItem("actor", 1), x: 2, z: -2, y: 0 };
  const path = {
    waypoints: [],
    end: { x: 2, z: 2, y: 0, rotation: 0 },
  };
  assert.deepEqual(
    actorRouteCollisions(actor, path, [wall]).map((hit) => hit.wallId),
    [wall.id],
  );
  wall.opening = { type: "door", offset: 0, width: 1.2, sill: 0, height: 2.1 };
  assert.deepEqual(actorRouteCollisions(actor, path, [wall]), []);
  wall.opening.width = 0.3;
  assert.equal(actorRouteCollisions(actor, path, [wall]).length, 1);
  wall.opening.width = 1.2;
  wall.opening.height = 1.5;
  assert.equal(actorRouteCollisions(actor, path, [wall]).length, 1);
  wall.hidden = true;
  assert.deepEqual(actorRouteCollisions(actor, path, [wall]), []);
});

test("actor route checks every leg even when timing weights differ", () => {
  const wall = wallBetween({ x: 0, z: 0 }, { x: 4, z: 0 }, 1);
  const actor = { ...makeItem("actor", 1), x: -2, z: -2, y: 0 };
  const path = {
    waypoints: [{ x: 2, z: -2, y: 0, rotation: 0 }],
    end: { x: 2, z: 2, y: 0, rotation: 0 },
    legs: [
      { weight: 100, easing: "smooth" },
      { weight: 0.1, easing: "linear" },
    ],
  };
  assert.equal(actorRouteCollisions(actor, path, [wall]).length, 1);
});
