import test from "node:test";
import assert from "node:assert/strict";
import { makeItem } from "../src/model.ts";
import {
  floorIlluminance,
  sampleFloorIlluminance,
  traceFloor,
} from "../src/lighting.ts";

function fixture(height = 2) {
  return {
    ...makeItem("light", 1),
    x: 0,
    y: 0,
    z: 0,
    height,
    lightType: "practical",
    lumens: 1000,
  };
}

function blocker() {
  return {
    ...makeItem("box", 1),
    x: 2,
    y: 0,
    z: 0,
    width: 1,
    height: 3,
    depth: 1,
  };
}

test("solid props occlude direct floor light and moving or hiding them restores it", () => {
  const light = fixture();
  const point = { x: 4, z: 0 };
  const box = blocker();
  const unblocked = floorIlluminance(light, point, []);
  assert.ok(unblocked > 0);
  assert.equal(floorIlluminance(light, point, [], [box]), 0);
  assert.equal(sampleFloorIlluminance([light, box], point).total, 0);
  assert.equal(
    floorIlluminance(light, point, [], [{ ...box, z: 3 }]),
    unblocked,
  );
  assert.equal(
    sampleFloorIlluminance([light, { ...box, hidden: true }], point).total,
    unblocked,
  );
});

test("ray height is checked against elevated and low props", () => {
  const point = { x: 4, z: 0 };
  const box = blocker();
  assert.ok(
    floorIlluminance(fixture(4), point, [], [{ ...box, height: 1 }]) > 0,
  );
  assert.equal(
    floorIlluminance(fixture(4), point, [], [{ ...box, y: 1.5, height: 1 }]),
    0,
  );
  assert.ok(
    floorIlluminance(fixture(0.5), point, [], [{ ...box, y: 1, height: 1 }]) >
      0,
  );
});

test("rotated narrow props cast an oriented shadow", () => {
  const light = fixture();
  const point = { x: 4, z: 1.4 };
  const box = { ...blocker(), width: 2, depth: 0.2 };
  assert.ok(floorIlluminance(light, point, [], [box]) > 0);
  assert.equal(
    floorIlluminance(light, point, [], [{ ...box, rotation: 90 }]),
    0,
  );
});

test("trace and meter use the same object occlusion", () => {
  const light = fixture();
  const box = blocker();
  const scene = [light, box];
  const trace = traceFloor(scene, 0.5);
  assert.ok(trace);
  for (const [column, row] of [
    [0, 0],
    [trace.width - 1, Math.floor(trace.height / 2)],
    [Math.floor(trace.width / 2), Math.floor(trace.height / 2)],
  ]) {
    const point = {
      x: trace.minX + ((column + 0.5) * trace.worldWidth) / trace.width,
      z: trace.minZ + ((row + 0.5) * trace.worldHeight) / trace.height,
    };
    const meter = sampleFloorIlluminance(scene, point).total;
    assert.ok(
      Math.abs(trace.values[row * trace.width + column] - meter) < 1e-5,
    );
  }
});
