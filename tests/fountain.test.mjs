import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFountainScenes,
  reconcileFountainScenes,
} from "../src/fountain.ts";

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
      explicitNumber: true,
      title: "KITCHEN",
      intExt: "INT",
      timeOfDay: "NIGHT",
      synopsis: "A late dinner.",
    },
    {
      sceneNumber: "2",
      explicitNumber: true,
      title: "STREET",
      intExt: "EXT",
      timeOfDay: "DAY",
    },
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
    {
      sceneNumber: "1",
      explicitNumber: false,
      title: "patio",
      intExt: "EXT",
      timeOfDay: "DUSK",
    },
    {
      sceneNumber: "A-3",
      explicitNumber: true,
      title: "SNIPER POV",
      intExt: "INT/EXT",
      timeOfDay: "OTHER",
    },
  ]);
});

test("a numbered script revision preserves IDs and breakdown work", () => {
  const prior = {
    id: "scene-1",
    sceneNumber: "1A",
    title: "KITCHEN",
    intExt: "INT",
    timeOfDay: "DAY",
    pageEighths: 12,
    cast: ["Mara"],
    props: ["Letter"],
    wardrobe: [],
    effects: [],
    setSceneId: "set-1",
  };
  const revision = parseFountainScenes(`EXT. KITCHEN GARDEN - DUSK #1A#

= The letter is found.

INT. HALL - NIGHT #2#`);
  let nextId = 2;
  const result = reconcileFountainScenes(
    [prior],
    revision,
    () => `scene-${nextId++}`,
  );
  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.missing, 0);
  assert.deepEqual(result.scenes[0], {
    ...prior,
    title: "KITCHEN GARDEN",
    intExt: "EXT",
    timeOfDay: "DUSK",
    synopsis: "The letter is found.",
  });
  assert.equal(result.scenes[1].id, "scene-2");
});

test("unnumbered or ambiguous revisions do not overwrite existing scenes", () => {
  const prior = {
    id: "scene-1",
    sceneNumber: "1",
    title: "KITCHEN",
    intExt: "INT",
    timeOfDay: "DAY",
    pageEighths: 8,
    cast: [],
    props: [],
    wardrobe: [],
    effects: [],
  };
  const unnumbered = parseFountainScenes("EXT. GARDEN - NIGHT");
  const unchanged = reconcileFountainScenes([prior], unnumbered, () => "new");
  assert.deepEqual(unchanged.scenes, [prior]);
  assert.equal(unchanged.skipped, 1);
  const duplicate = parseFountainScenes(
    "EXT. GARDEN - NIGHT #1#\n\nINT. HALL - DAY #1#",
  );
  const ambiguous = reconcileFountainScenes([prior], duplicate, () => "new");
  assert.deepEqual(ambiguous.scenes, [prior]);
  assert.equal(ambiguous.skipped, 2);
});

test("a numbered revision can reorder scenes without changing their IDs", () => {
  const makeScene = (number) => ({
    id: `scene-${number}`,
    sceneNumber: number,
    title: `PLACE ${number}`,
    intExt: "INT",
    timeOfDay: "DAY",
    pageEighths: 8,
    cast: [],
    props: [],
    wardrobe: [],
    effects: [],
  });
  const existing = [makeScene("1"), makeScene("2")];
  const incoming = parseFountainScenes(
    "INT. PLACE 2 - DAY #2#\n\nINT. PLACE 1 - DAY #1#",
  );
  const result = reconcileFountainScenes(existing, incoming, () => "unused");
  assert.equal(result.reordered, true);
  assert.equal(result.updated, 0);
  assert.deepEqual(
    result.scenes.map((scene) => scene.id),
    ["scene-2", "scene-1"],
  );
});
