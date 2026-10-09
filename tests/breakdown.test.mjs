import test from "node:test";
import assert from "node:assert/strict";
import { scriptBreakdownCSV } from "../src/breakdown.ts";

const scene = (id, name, shots = []) => ({
  id,
  name,
  items: [],
  shots,
  shootOrder: [],
});
const scriptScene = (overrides = {}) => ({
  id: "script-a",
  sceneNumber: "1A",
  title: "The arrival",
  intExt: "INT",
  timeOfDay: "DAY",
  setSceneId: "set-a",
  pageEighths: 3,
  cast: ["Alex", "Morgan"],
  props: ["Letter"],
  wardrobe: ["Coat"],
  effects: ["Rain"],
  ...overrides,
});

test("breakdown counts linked shots across sets and retains unshot scenes", () => {
  const project = {
    version: 1,
    name: "Film",
    scenes: [
      scene("set-a", "Lobby", [
        { id: "shot-1", scriptSceneId: "script-a" },
        { id: "shot-2", scriptSceneId: "script-a" },
      ]),
      scene("set-b", "Backlot", [
        { id: "shot-3", scriptSceneId: "script-a" },
        { id: "shot-4", scriptSceneId: "script-other" },
      ]),
    ],
    scriptScenes: [
      scriptScene(),
      scriptScene({
        id: "script-b",
        sceneNumber: "2",
        title: "Quiet room",
        setSceneId: "set-b",
        cast: [],
        props: [],
        wardrobe: [],
        effects: [],
      }),
    ],
  };
  const lines = scriptBreakdownCSV(project).trimEnd().split("\r\n");
  assert.match(lines[0], /^Project,Scene number,Scene title,INT\/EXT,/);
  assert.equal(lines.length, 3);
  assert.match(
    lines[1],
    /^Film,1A,The arrival,INT,DAY,Lobby,3,3,Alex; Morgan,Letter,Coat,Rain,,/,
  );
  assert.match(lines[2], /^Film,2,Quiet room,INT,DAY,Backlot,3,0,,,,,,/);
});

test("breakdown escapes commas, quotes, and newlines in exported text", () => {
  const project = {
    version: 1,
    name: 'A "Film", Inc.',
    scenes: [scene("set-a", "Hall, North")],
    scriptScenes: [
      scriptScene({
        title: 'She says "go", then leaves',
        synopsis: "First line\nSecond line",
        notes: 'Bring "hero", backup',
      }),
    ],
  };
  const csv = scriptBreakdownCSV(project);
  assert.match(csv, /"A ""Film"", Inc\."/);
  assert.match(csv, /"She says ""go"", then leaves"/);
  assert.match(csv, /"Hall, North"/);
  assert.match(csv, /"First line\nSecond line"/);
  assert.match(csv, /"Bring ""hero"", backup"/);
  assert.equal(csv.endsWith("\r\n"), true);
});

test("legacy projects without script scenes export a heading only", () => {
  const csv = scriptBreakdownCSV({ version: 1, name: "Old", scenes: [] });
  assert.equal(csv.split("\r\n").length, 2);
  assert.match(csv, /^Project,Scene number,Scene title/);
});
