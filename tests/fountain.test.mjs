import assert from "node:assert/strict";
import test from "node:test";
import { parseFountainScenes } from "../src/fountain.ts";

test("Fountain headings preserve scene numbers and synopses", () => {
  const scenes = parseFountainScenes(`Title: Example

INT. KITCHEN - NIGHT #1A#

= A late dinner.

Two actors talk.

EXT. STREET - DAY #2#

Traffic passes.`);
  assert.deepEqual(scenes, [
    {
      sceneNumber: "1A",
      title: "KITCHEN",
      intExt: "INT",
      timeOfDay: "NIGHT",
      synopsis: "A late dinner.",
    },
    { sceneNumber: "2", title: "STREET", intExt: "EXT", timeOfDay: "DAY" },
  ]);
});

test("Fountain parser accepts forced and mixed headings but skips action and boneyard", () => {
  const scenes = parseFountainScenes(`/*
INT. OMITTED - DAY
*/

ext. patio - dusk

Action INT. IS NOT A HEADING - DAY

.SNIPER POV #A-3#
Action follows immediately.`);
  assert.deepEqual(scenes, [
    { sceneNumber: "1", title: "patio", intExt: "EXT", timeOfDay: "DUSK" },
    {
      sceneNumber: "A-3",
      title: "SNIPER POV",
      intExt: "INT/EXT",
      timeOfDay: "OTHER",
    },
  ]);
});
